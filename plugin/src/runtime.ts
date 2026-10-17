/**
 * State shared by all actions: the DCS-BIOS link, every aircraft's control list,
 * global settings, the update check and the VR mirror.
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { PRODUCT } from "../../core/aircraft.data.ts";
import { defaultJsonDir, Fleet } from "../../core/aircraft.ts";
import { DcsBiosClient } from "../../core/dcsbios/client.ts";
import type { Release } from "../../core/updates.ts";
import { pluginName, Updater } from "../../core/updates.ts";
import { MirrorState } from "./mirror.ts";

export type GlobalSettings = {
	/** Folder with the DCS-BIOS control JSON files. Empty = default Saved Games location. */
	jsonDir?: string;
	/** Port of the VR mirror page. */
	mirrorPort?: number;
};

export const DEFAULT_MIRROR_PORT = PRODUCT.mirrorPort;

export const client = new DcsBiosClient();
export const fleet = new Fleet(client);
export const mirror = new MirrorState();

export const runtime = {
	settings: {} as GlobalSettings,
	updater: undefined as Updater | undefined,
};

const resetListeners = new Set<() => void>();

/** Called when actions must re-read controls and redraw (DCS status, aircraft or control lists changed). */
export function onReset(listener: () => void): void {
	resetListeners.add(listener);
}

export function reset(): void {
	for (const listener of resetListeners) listener();
}

export function jsonDir(): string {
	return runtime.settings.jsonDir?.trim() || defaultJsonDir();
}

export function loadAircraft(): void {
	fleet.load(jsonDir());
}

/** Checks GitHub for a newer plugin now and once a day; `onStatus` gets each result. */
export function startUpdateChecks(currentVersion: string, onStatus: () => void): void {
	runtime.updater = new Updater({
		currentVersion,
		fileName: pluginName,
		onStatus,
		releasesApi: process.env.D2S_RELEASES_API || undefined,
	});
	void runtime.updater.check();
	setInterval(() => void runtime.updater?.check(), 24 * 60 * 60 * 1000).unref();
}

/**
 * Downloads the newer plugin and opens it: the Stream Deck app then installs it over this one
 * (same UUID, so keys and settings stay) and restarts the plugin.
 */
export function installUpdate(): void {
	void runtime.updater?.install(path.join(os.tmpdir(), "dcs2streamdeck-update"), openPluginFile);
}

async function openPluginFile(file: string, release: Release): Promise<string> {
	const opener =
		process.platform === "win32"
			? [path.join(process.env.SystemRoot ?? "C:\\Windows", "explorer.exe"), file]
			: process.platform === "darwin"
				? ["open", file]
				: undefined;
	if (!opener) return `Downloaded to ${file}; open it to install.`;
	await new Promise<void>((resolve, reject) => {
		const child = spawn(opener[0], opener.slice(1), { detached: true, stdio: "ignore" });
		child.once("error", reject);
		child.once("spawn", () => {
			child.unref();
			resolve();
		});
	});
	return `The Stream Deck app is installing ${release.version}: confirm in its window. Your keys are kept.`;
}
