/**
 * Every aircraft the plugin and app support (aircraft/<id>/aircraft.ts), and the product's IDs.
 * One plugin and one app cover them all; each key picks its own aircraft.
 */
import * as ah64d from "../aircraft/ah64d/aircraft.ts";
import * as f16c from "../aircraft/f16c/aircraft.ts";
import * as fa18c from "../aircraft/fa18c/aircraft.ts";
import type { LampColour, LeverEnd, Seats } from "./dcsbios/controls.ts";

export type AircraftData = {
	AIRCRAFT: {
		readonly id: string;
		readonly module: string;
		/** What DCS calls the aircraft, when it differs from the DCS-BIOS module name. */
		readonly dcsName?: string;
		readonly name: string;
		readonly fullName: string;
	};
	KNOWN_LAMPS: Record<string, string>;
	POSITION_NAMES: Record<string, string[]>;
	HIGH_END_OF_THREE: "up" | "down";
	HIGH_END: Record<string, LeverEnd>;
	KNOWN_PUSH_BUTTONS: string[];
	LEVER_KNOBS: Record<string, "wheel" | "hook">;
	KNOWN_COLOURS: Record<string, LampColour>;
	INDICATORS: { name: string; kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> }[];
	DIAL_PRESETS: [string, string][];
	ROTARY_KNOBS?: Record<string, "cw" | "ccw">;
	/** Positions that spring back when let go, where the DCS-BIOS switch type does not say (see `springBack`). */
	SPRING_LOADED?: Record<string, { from: number[]; rest?: number }>;
	SEATS?: Seats;
};

/**
 * The former F/A-18C plugin's IDs, so its keys carry over. Never change uuid (installed plugins
 * update by it) or appId (the feedback relay's app ID).
 */
export const PRODUCT = {
	uuid: "com.adamchesters.dcs2streamdeck",
	appId: "dcs2streamdeck",
	mirrorPort: 31730,
} as const;

export const AIRCRAFT_LIST: readonly AircraftData[] = [fa18c, f16c, ah64d];

/** Keys saved before 0.4.0 have no aircraft setting: they came from the F/A-18C plugin. */
export const DEFAULT_AIRCRAFT: AircraftData = fa18c;

export function aircraftById(id: string | undefined): AircraftData {
	return AIRCRAFT_LIST.find((a) => a.AIRCRAFT.id === id) ?? DEFAULT_AIRCRAFT;
}

/** The aircraft for a DCS-BIOS module name, if supported. */
export function aircraftByModule(module: string): AircraftData | undefined {
	return AIRCRAFT_LIST.find((a) => a.AIRCRAFT.module === module);
}

/** What DCS calls the aircraft (DCS-BIOS reports it as the aircraft being flown). */
export function dcsName(aircraft: AircraftData): string {
	return aircraft.AIRCRAFT.dcsName ?? aircraft.AIRCRAFT.module;
}

/** The aircraft DCS reports it is flying, if supported. */
export function aircraftByDcsName(name: string): AircraftData | undefined {
	return AIRCRAFT_LIST.find((a) => dcsName(a) === name);
}

/**
 * A key's or dial's aircraft: its own setting; set up before 0.4.0 (no setting) = F/A-18C;
 * a new, empty one starts on the aircraft DCS is flying.
 */
export function aircraftOf(
	settings: { aircraft?: string; control?: string; lamp?: string; functions?: string },
	flying?: AircraftData,
): AircraftData {
	if (settings.aircraft) return aircraftById(settings.aircraft);
	const used = Boolean(settings.control || settings.lamp || settings.functions?.trim());
	return used ? DEFAULT_AIRCRAFT : (flying ?? DEFAULT_AIRCRAFT);
}
