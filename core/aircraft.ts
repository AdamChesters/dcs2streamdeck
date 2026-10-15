/**
 * Finds and loads the DCS-BIOS control list for this plugin's aircraft.
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { AIRCRAFT } from "./aircraft.data.ts";
import type { ControlMap } from "./dcsbios/controls.ts";
import { loadControls } from "./dcsbios/controls.ts";

export const DEFAULT_MODULE = AIRCRAFT.module;

export function defaultJsonDir(): string {
	return path.join(os.homedir(), "Saved Games", "DCS", "Scripts", "DCS-BIOS", "doc", "json");
}

export type LoadResult = { controls: ControlMap; loaded: string[]; error: string };

/** Loads this plugin's aircraft control list (only that aircraft, to keep the pickers short). */
export function loadAircraftControls(dir: string): LoadResult {
	const file = path.join(dir, `${AIRCRAFT.module}.json`);
	if (!existsSync(file)) return { controls: new Map(), loaded: [], error: `No DCS-BIOS control file ${AIRCRAFT.module}.json in ${dir}` };
	return { controls: loadControls(file), loaded: [AIRCRAFT.module], error: "" };
}

/** True when DCS is flying this plugin's aircraft. */
export function isOurAircraft(name: string): boolean {
	return name === AIRCRAFT.module;
}

/** Key text when DCS is not flying this aircraft. */
export function offlineText(connected: boolean): string {
	return connected ? `NO ${AIRCRAFT.name}` : "NO DCS";
}
