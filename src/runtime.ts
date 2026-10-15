/**
 * State shared by all actions: the DCS-BIOS link, the loaded control list,
 * global settings and the VR mirror.
 */
import { AIRCRAFT } from "./core/aircraft.data.ts";
import { defaultJsonDir, isOurAircraft, loadAircraftControls, offlineText } from "./core/aircraft.ts";
import type { Dcs } from "./core/bindings.ts";
import { DcsBiosClient } from "./core/dcsbios/client.ts";
import type { Control, ControlMap } from "./core/dcsbios/controls.ts";
import { MirrorState } from "./mirror.ts";


export type GlobalSettings = {
	/** Folder with the DCS-BIOS control JSON files. Empty = default Saved Games location. */
	jsonDir?: string;
	/** Port of the VR mirror page. */
	mirrorPort?: number;
};

export const DEFAULT_MIRROR_PORT = 31730;

export const client = new DcsBiosClient();

/** DCS as the keys see it: live only while DCS flies this plugin's aircraft. */
export const dcs: Dcs = {
	get connected() {
		return client.connected && isOurAircraft(client.aircraft);
	},
	get offline() {
		return offlineText(client.connected);
	},
	read: (c) => (isOurAircraft(client.aircraft) ? client.read(c) : undefined),
	send: (identifier, argument) => {
		if (isOurAircraft(client.aircraft)) client.send(identifier, argument);
	},
};
export const mirror = new MirrorState();

export const runtime = {
	settings: {} as GlobalSettings,
	controls: new Map() as ControlMap,
	/** Module names loaded, or the error that stopped loading. */
	loaded: [] as string[],
	loadError: "",
};

const resetListeners = new Set<() => void>();

/** Called when actions must re-read controls and redraw (DCS status, aircraft or control list changed). */
export function onReset(listener: () => void): void {
	resetListeners.add(listener);
}

export function reset(): void {
	for (const listener of resetListeners) listener();
}

export function control(identifier: string | undefined): Control | undefined {
	return identifier ? runtime.controls.get(identifier.trim()) : undefined;
}

export function jsonDir(): string {
	return runtime.settings.jsonDir?.trim() || defaultJsonDir();
}

export function loadAircraft(): void {
	const result = loadAircraftControls(jsonDir());
	runtime.loadError = result.error;
	if (result.error) return;
	runtime.controls = result.controls;
	runtime.loaded = result.loaded;
}

/** Status text for the property inspector. */
export function statusText(): string {
	const state = !client.connected
		? "DCS not sending data"
		: isOurAircraft(client.aircraft)
			? `DCS connected (${AIRCRAFT.name})`
			: `DCS is flying ${client.aircraft || "no aircraft"}; this plugin is for the ${AIRCRAFT.name}`;
	const list = runtime.loadError || `${runtime.controls.size} ${AIRCRAFT.name} controls`;
	return `${state}. ${list}.`;
}
