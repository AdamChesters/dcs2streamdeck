/**
 * Updates from GitHub releases (Alpha releases included), for the plugin and the app.
 * Each looks for its own download in a release, shows that a newer version is out, and can
 * download it (size and SHA-256 checked) for the product to install. No Electron or Stream
 * Deck imports, so it runs in tests.
 */
import { createHash } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";


export const REPO = "AdamChesters/dcs2streamdeck";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

export type Release = {
	tag: string;
	version: string;
	page: string;
	notes: string;
	/** This product's download in the release. */
	fileName: string;
	fileUrl: string;
	/** Its size and SHA-256 (hex) as GitHub reports them; 0 / "" when not reported. */
	size: number;
	sha256: string;
};

/** checking → current | available | failed (check failed); available → downloading → installing. */
export type UpdateState = "checking" | "current" | "available" | "downloading" | "installing" | "failed";

export type UpdateStatus = {
	state: UpdateState;
	current: string;
	release?: Release;
	/** Why the check or the last install failed, or what installing is doing. */
	message: string;
	/** Download progress, 0 to 1. */
	progress?: number;
};

/** The app's download in a release. */
export function zipName(version: string): string {
	return `dcs2streamdeck-${version}-win.zip`;
}

/** The plugin's download in a release. */
export function pluginName(version: string): string {
	return `dcs2streamdeck-${version}.streamDeckPlugin`;
}

/** A Stream Deck version ("0.4.0.0") as a release version ("0.4.0"). */
export function releaseVersion(version: string): string {
	return version.split(".").slice(0, 3).join(".");
}

type Version = { numbers: number[]; pre: string[] };

function parseVersion(text: string): Version {
	const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text.trim());
	if (!m) throw new Error(`Invalid version ${text}`);
	return { numbers: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split(".") : [] };
}

/** Semantic-version order, so 0.2.0 > 0.2.0-alpha.10 > 0.2.0-alpha.9. */
export function compareVersions(left: string, right: string): number {
	const a = parseVersion(left);
	const b = parseVersion(right);
	for (let i = 0; i < 3; i++) if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i] ? 1 : -1;
	if (!a.pre.length || !b.pre.length) return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
	for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
		const x = a.pre[i];
		const y = b.pre[i];
		if (x === y) continue;
		const xn = /^\d+$/.test(x);
		const yn = /^\d+$/.test(y);
		if (xn && yn) return Number(x) > Number(y) ? 1 : -1;
		if (xn !== yn) return xn ? -1 : 1;
		return x > y ? 1 : -1;
	}
	return a.pre.length === b.pre.length ? 0 : a.pre.length > b.pre.length ? 1 : -1;
}

type GitHubRelease = {
	draft?: boolean;
	tag_name?: string;
	html_url?: string;
	body?: string;
	assets?: { name?: string; state?: string; size?: number; browser_download_url?: string; digest?: string }[];
};

/**
 * Newest non-draft release that has this product's download (releases without it are skipped).
 * Downloads must start with `downloadPrefix` (GitHub's release downloads unless a test says).
 */
export function newestRelease(
	list: unknown,
	fileName: (version: string) => string,
	downloadPrefix = `${RELEASES_PAGE}/download/`,
): Release | undefined {
	if (!Array.isArray(list)) throw new Error("GitHub did not return a releases list");
	let newest: Release | undefined;
	for (const item of list as GitHubRelease[]) {
		try {
			if (item.draft || !item.tag_name) continue;
			const tag = item.tag_name;
			parseVersion(tag);
			if (newest && compareVersions(tag, newest.tag) <= 0) continue;
			const version = tag.replace(/^v/, "");
			const file = item.assets?.find((a) => a.name === fileName(version) && a.state === "uploaded");
			if (!file?.browser_download_url?.startsWith(downloadPrefix)) continue;
			newest = {
				tag,
				version,
				page: `${RELEASES_PAGE}/tag/${tag}`,
				notes: (item.body ?? "").slice(0, 4000),
				fileName: file.name!,
				fileUrl: file.browser_download_url,
				size: Number.isSafeInteger(file.size) && file.size! > 0 ? file.size! : 0,
				sha256: /^sha256:[0-9a-f]{64}$/.test(file.digest ?? "") ? file.digest!.slice(7) : "",
			};
		} catch {
			// Ignore malformed or unrelated releases.
		}
	}
	return newest;
}

export type UpdaterOptions = {
	currentVersion: string;
	/** This product's download name for a version: zipName or pluginName. */
	fileName: (version: string) => string;
	onStatus: (status: UpdateStatus) => void;
	/** For tests. */
	fetch?: typeof fetch;
	/** Another releases list (tests); its own server may then serve the downloads too. */
	releasesApi?: string;
};

/** Installs a downloaded file; returns what the user should see while it happens. */
export type Installer = (file: string, release: Release) => Promise<string>;

export class Updater {
	status: UpdateStatus;
	#o: UpdaterOptions;

	constructor(options: UpdaterOptions) {
		this.#o = options;
		this.status = { state: "checking", current: options.currentVersion, message: "" };
	}

	#set(patch: Partial<UpdateStatus>): void {
		this.status = { ...this.status, ...patch };
		this.#o.onStatus(this.status);
	}

	get busy(): boolean {
		return this.status.state === "downloading" || this.status.state === "installing";
	}

	async check(): Promise<void> {
		if (this.busy) return;
		this.#set({ state: "checking", message: "", release: undefined, progress: undefined });
		try {
			const response = await (this.#o.fetch ?? fetch)(
				this.#o.releasesApi ?? `https://api.github.com/repos/${REPO}/releases?per_page=30`,
				{ headers: { Accept: "application/vnd.github+json", "User-Agent": "dcs2streamdeck" }, signal: AbortSignal.timeout(10000) },
			);
			if (response.status === 404) throw new Error("no public release found on GitHub");
			if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
			const prefix = this.#o.releasesApi ? `${new URL(this.#o.releasesApi).origin}/` : undefined;
			const release = newestRelease(await response.json(), this.#o.fileName, prefix);
			if (!release) throw new Error("No published version could be checked on GitHub");
			const newer = compareVersions(release.version, this.#o.currentVersion) > 0;
			this.#set({ state: newer ? "available" : "current", release });
		} catch (error) {
			this.#set({ state: "failed", message: `Could not check for updates: ${(error as Error).message}` });
		}
	}

	/**
	 * Downloads the available release into `dir` (emptied first), checks its size and SHA-256,
	 * then hands it to `installer`. A failure goes back to "available" with the reason.
	 */
	async install(dir: string, installer: Installer): Promise<void> {
		const release = this.status.release;
		if (this.status.state !== "available" || !release) return;
		this.#set({ state: "downloading", message: "", progress: 0 });
		try {
			const file = await this.#download(release, dir);
			this.#set({ state: "installing", progress: 1, message: "" });
			this.#set({ message: await installer(file, release) });
		} catch (error) {
			this.#set({ state: "available", progress: undefined, message: `Update failed: ${(error as Error).message}` });
		}
	}

	async #download(release: Release, dir: string): Promise<string> {
		await rm(dir, { recursive: true, force: true });
		await mkdir(dir, { recursive: true });
		const file = path.join(dir, path.basename(release.fileName));
		const response = await (this.#o.fetch ?? fetch)(release.fileUrl, {
			headers: { "User-Agent": "dcs2streamdeck" },
			signal: AbortSignal.timeout(30 * 60 * 1000),
		});
		if (!response.ok || !response.body) throw new Error(`download answered ${response.status}`);
		const total = release.size || Number(response.headers.get("content-length")) || 0;
		const hash = createHash("sha256");
		const out = await open(`${file}.part`, "w");
		let bytes = 0;
		let shown = 0;
		try {
			for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
				hash.update(chunk);
				await out.write(chunk);
				bytes += chunk.length;
				const progress = total ? Math.min(bytes / total, 1) : 0;
				if (progress - shown >= 0.02) {
					shown = progress;
					this.#set({ progress });
				}
			}
		} finally {
			await out.close();
		}
		if (release.size && bytes !== release.size) throw new Error(`download was ${bytes} bytes, expected ${release.size}`);
		if (release.sha256 && hash.digest("hex") !== release.sha256) throw new Error("download does not match its SHA-256");
		await rename(`${file}.part`, file);
		return file;
	}
}
