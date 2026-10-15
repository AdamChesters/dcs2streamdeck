/**
 * Self-update from GitHub releases:
 * check at launch (Alpha releases included), show current / update available,
 * then download the Setup.exe, check its size and SHA-256 against GitHub, and run it.
 * No Electron imports, so it runs in tests.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { AIRCRAFT } from "../../core/aircraft.data.ts";

export const REPO = "AdamChesters/dcs2streamdeck";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const MAX_INSTALLER_BYTES = 512 * 1024 * 1024;

export type Release = {
	tag: string;
	version: string;
	page: string;
	notes: string;
	installerName: string;
	installerUrl: string;
	size: number;
	/** Lower-case hex SHA-256 from GitHub's asset digest. */
	digest: string;
};

export type UpdateState = "checking" | "current" | "available" | "downloading" | "ready" | "failed";

export type UpdateStatus = {
	state: UpdateState;
	current: string;
	release?: Release;
	/** Bytes downloaded so far. */
	downloaded: number;
	message: string;
	installer?: string;
};

export function installerName(version: string): string {
	return `${AIRCRAFT.appId}-${version}-Setup.exe`;
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

/** Newest non-draft release, with its verified-installable Setup.exe when present. */
export function newestRelease(list: unknown): Release | undefined {
	if (!Array.isArray(list)) throw new Error("GitHub did not return a releases list");
	let newest: Release | undefined;
	for (const item of list as GitHubRelease[]) {
		try {
			if (item.draft || !item.tag_name) continue;
			const tag = item.tag_name;
			parseVersion(tag);
			if (newest && compareVersions(tag, newest.tag) <= 0) continue;
			const version = tag.replace(/^v/, "");
			const release: Release = {
				tag,
				version,
				page: `${RELEASES_PAGE}/tag/${tag}`,
				notes: (item.body ?? "").slice(0, 4000),
				installerName: "",
				installerUrl: "",
				size: 0,
				digest: "",
			};
			const asset = item.assets?.find((a) => a.name === installerName(version) && a.state === "uploaded");
			if (asset) {
				release.installerName = asset.name!;
				release.installerUrl = asset.browser_download_url ?? "";
				release.size = typeof asset.size === "number" && asset.size > 0 ? asset.size : 0;
				release.digest = asset.digest?.startsWith("sha256:") ? asset.digest.slice(7).toLowerCase() : "";
			}
			newest = release;
		} catch {
			// Ignore malformed or unrelated releases.
		}
	}
	return newest;
}

export function installable(r: Release): boolean {
	return (
		r.size > 0 &&
		r.size <= MAX_INSTALLER_BYTES &&
		/^[0-9a-f]{64}$/.test(r.digest) &&
		r.installerName === installerName(r.version) &&
		r.installerUrl === `${RELEASES_PAGE}/download/${r.tag}/${r.installerName}`
	);
}

/** Only GitHub's release download and asset hosts may serve the installer. */
export function allowedDownloadUrl(url: string, redirect: boolean): boolean {
	if (url.length > 8192 || /[\s\\#]/.test(url)) return false;
	if (url.startsWith(`${RELEASES_PAGE}/download/`)) return true;
	return (
		redirect &&
		(url.startsWith("https://release-assets.githubusercontent.com/") ||
			url.startsWith("https://objects.githubusercontent.com/"))
	);
}

export type UpdaterOptions = {
	currentVersion: string;
	/** Folder for downloads (inside the app's data folder). */
	downloadDir: string;
	onStatus: (status: UpdateStatus) => void;
	/** For tests. */
	fetch?: typeof fetch;
	releasesApi?: string;
	allowUrl?: (url: string, redirect: boolean) => boolean;
};

export class Updater {
	status: UpdateStatus;
	#o: UpdaterOptions;
	#abort?: AbortController;

	constructor(options: UpdaterOptions) {
		this.#o = options;
		this.status = { state: "checking", current: options.currentVersion, downloaded: 0, message: "" };
	}

	#set(patch: Partial<UpdateStatus>): void {
		this.status = { ...this.status, ...patch };
		this.#o.onStatus(this.status);
	}

	async check(): Promise<void> {
		if (this.status.state === "downloading") return;
		this.#set({ state: "checking", message: "", release: undefined, installer: undefined, downloaded: 0 });
		try {
			const response = await (this.#o.fetch ?? fetch)(
				this.#o.releasesApi ?? `https://api.github.com/repos/${REPO}/releases?per_page=30`,
				{ headers: { Accept: "application/vnd.github+json", "User-Agent": "dcs2streamdeck" }, signal: AbortSignal.timeout(10000) },
			);
			if (response.status === 404) throw new Error("no public release found on GitHub");
			if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
			const release = newestRelease(await response.json());
			if (!release) throw new Error("No published version could be checked on GitHub");
			const newer = compareVersions(release.version, this.#o.currentVersion) > 0;
			this.#set({ state: newer ? "available" : "current", release });
		} catch (error) {
			this.#set({ state: "failed", message: `Could not check for updates: ${(error as Error).message}` });
		}
	}

	/** Downloads and verifies the installer. Ends in "ready" or "failed". */
	async download(): Promise<void> {
		const release = this.status.release;
		if (this.status.state !== "available" && this.status.state !== "failed") return;
		if (!release || !installable(release) || compareVersions(release.version, this.#o.currentVersion) <= 0) {
			this.#set({ state: "failed", message: "No verified Windows installer is available for this release. Open Releases instead." });
			return;
		}
		this.#abort = new AbortController();
		this.#set({ state: "downloading", downloaded: 0, message: "" });
		const folder = path.join(this.#o.downloadDir, `${process.pid}-${Date.now()}`);
		const partial = path.join(folder, "installer.part");
		try {
			await mkdir(folder, { recursive: true });
			const allow = this.#o.allowUrl ?? allowedDownloadUrl;
			let url = release.installerUrl;
			let response: Response | undefined;
			for (let hop = 0; hop < 5; hop++) {
				if (!allow(url, hop > 0)) throw new Error("The installer link is not a GitHub release download.");
				response = await (this.#o.fetch ?? fetch)(url, {
					redirect: "manual",
					headers: { "User-Agent": "dcs2streamdeck" },
					signal: this.#abort.signal,
				});
				const next = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
				if (!next) break;
				url = new URL(next, url).href;
			}
			if (!response?.ok || !response.body) throw new Error(`Download failed (${response?.status ?? "no answer"}).`);

			const hash = createHash("sha256");
			const file = createWriteStream(partial);
			let received = 0;
			for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
				received += chunk.length;
				if (received > release.size) throw new Error("The installer download is larger than GitHub reported.");
				hash.update(chunk);
				if (!file.write(chunk)) await new Promise<void>((r) => file.once("drain", () => r()));
				this.#set({ downloaded: received });
			}
			await new Promise<void>((resolve, reject) => file.end((err?: Error | null) => (err ? reject(err) : resolve())));
			if (received !== release.size) throw new Error("The installer download is incomplete. Please retry.");
			if (hash.digest("hex") !== release.digest) throw new Error("The installer checksum does not match GitHub. Please retry.");
			const installer = path.join(folder, release.installerName);
			await rename(partial, installer);
			this.#set({ state: "ready", installer });
		} catch (error) {
			await rm(partial, { force: true });
			this.#set({ state: "failed", message: (error as Error).message });
		}
	}

	cancel(): void {
		this.#abort?.abort();
	}
}
