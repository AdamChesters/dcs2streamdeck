/**
 * DCS-BIOS control reference (the per-aircraft JSON that DCS-BIOS writes to
 * `Saved Games/DCS/Scripts/DCS-BIOS/doc/json/<module>.json`).
 */
import { readFileSync } from "node:fs";

import type { AircraftData } from "../aircraft.data.ts";

export type ControlInput =
	| { interface: "action"; argument: string; description: string }
	| { interface: "fixed_step"; description: string }
	| { interface: "set_state"; max_value: number; description: string }
	| { interface: "variable_step"; max_value: number; suggested_step: number; description: string }
	| { interface: "set_string"; description: string };

export type ControlOutput =
	| { type: "integer"; address: number; mask: number; shift_by: number; max_value: number; description: string }
	| { type: "string"; address: number; max_length: number; description: string };

export type Control = {
	identifier: string;
	category: string;
	control_type: string;
	description: string;
	inputs: ControlInput[];
	outputs: ControlOutput[];
	positions?: string[];
	api_variant?: string;
	/** Set by parseControls on lights: every light that is part of the same cockpit light (incl. this one). */
	family?: string[];
	/** Name of a multi-light indicator, e.g. "AOA Indexer". */
	familyName?: string;
	/** Picture and role of each light, for multi-light indicators (from the aircraft data). */
	indicator?: { kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> };
	/** From the aircraft data: a push button DCS-BIOS does not mark as momentary. */
	pushButton?: boolean;
	/** From the aircraft data: the light's colour when its description gives none. */
	knownColour?: LampColour;
	/** From the aircraft data: this switch's own light. */
	knownLamp?: string;
	/** From the aircraft data: the lever's special knob. */
	leverKnob?: "wheel" | "hook";
	/** 2- and 3-position switches: where the lever points at the highest position, as seen from the seat. */
	highEnd?: LeverEnd;
};

/** A lever's direction as seen from the seat ("up" is forward on the consoles). */
export type LeverEnd = "up" | "down" | "left" | "right";
export type LeverAt = LeverEnd | "middle";

const OPPOSITE: Record<LeverEnd, LeverEnd> = { up: "down", down: "up", left: "right", right: "left" };

export type ControlMap = Map<string, Control>;

/** Position names that mean "resting / normal", most resting first. */
export const RESTING = ["OFF", "SAFE", "RETRACT", "CLOSED", "CLOSE", "STBY", "NORM", "AUTO", "DISABLE"];

const restRank = (name: string) => {
	const i = RESTING.indexOf(name.toUpperCase());
	return i < 0 ? RESTING.length : i;
};

/**
 * Position names for 2-position switches from the description ("Master Arm Switch, ARM/SAFE").
 * The resting name (OFF, SAFE, NORM…) is position 0 whichever way round the description lists
 * it ("OFF/BIT", "ARM/SAFE"); with no resting name the first is position 1. Returns [name of 0, name of 1].
 */
function twoPositionNames(c: Control): string[] | undefined {
	const m = /,\s*([A-Za-z0-9][A-Za-z0-9 .-]*)\/([A-Za-z0-9][A-Za-z0-9 .-]*)\s*$/.exec(c.description);
	if (!m) return undefined;
	const first = m[1].trim().toUpperCase();
	const second = m[2].trim().toUpperCase();
	return restRank(first) < restRank(second) ? [first, second] : [second, first];
}

/** Reads one aircraft's control reference, adding what that aircraft's data knows. */
export function parseControls(json: unknown, aircraft: AircraftData): ControlMap {
	const map: ControlMap = new Map();
	for (const category of Object.values(json as Record<string, Record<string, Control>>)) {
		for (const control of Object.values(category)) map.set(control.identifier, control);
	}
	for (const c of map.values()) {
		if (aircraft.KNOWN_PUSH_BUTTONS.includes(c.identifier)) c.pushButton = true;
		if (aircraft.KNOWN_COLOURS[c.identifier]) c.knownColour = aircraft.KNOWN_COLOURS[c.identifier];
		if (aircraft.KNOWN_LAMPS[c.identifier]) c.knownLamp = aircraft.KNOWN_LAMPS[c.identifier];
		if (aircraft.LEVER_KNOBS[c.identifier]) c.leverKnob = aircraft.LEVER_KNOBS[c.identifier];
	}
	for (const c of map.values()) {
		const named = aircraft.POSITION_NAMES[c.identifier];
		if (named) c.positions = [...named];
		const max = intOutput(c)?.max_value;
		if (c.inputs.length === 0 || (max !== 1 && max !== 2) || isMomentary(c)) continue;
		if (!c.positions && max === 1) c.positions = twoPositionNames(c);
		const sideways = (c.positions ?? []).some((p) => /^(LEFT|RIGHT|L|R)$/i.test(p));
		c.highEnd = aircraft.HIGH_END[c.identifier] ?? (sideways ? "right" : max === 2 ? aircraft.HIGH_END_OF_THREE : "up");
	}
	// One cockpit light, several colours: same panel, same legend, e.g. "L BAR (green)" and "L BAR (red)".
	const legends = new Map<string, string[]>();
	for (const c of map.values()) {
		if (c.control_type !== "led") continue;
		const key = `${c.category}|${stripColour(c.description).toUpperCase()}`;
		legends.set(key, [...(legends.get(key) ?? []), c.identifier]);
	}
	for (const ids of legends.values()) {
		if (ids.length > 1) for (const id of ids) map.get(id)!.family = ids;
	}
	for (const { name, kind, roles } of aircraft.INDICATORS) {
		const ids = Object.values(roles);
		if (!ids.every((id) => map.has(id))) continue;
		for (const id of ids) Object.assign(map.get(id)!, { family: ids, familyName: name, indicator: { kind, roles } });
	}
	return map;
}

export function loadControls(path: string, aircraft: AircraftData): ControlMap {
	return parseControls(JSON.parse(readFileSync(path, "utf8")), aircraft);
}

export function input<K extends ControlInput["interface"]>(
	control: Control,
	kind: K,
): Extract<ControlInput, { interface: K }> | undefined {
	return control.inputs.find((i) => i.interface === kind) as Extract<ControlInput, { interface: K }> | undefined;
}

export function intOutput(control: Control): Extract<ControlOutput, { type: "integer" }> | undefined {
	return control.outputs.find((o) => o.type === "integer") as Extract<ControlOutput, { type: "integer" }> | undefined;
}

export function stringOutput(control: Control): Extract<ControlOutput, { type: "string" }> | undefined {
	return control.outputs.find((o) => o.type === "string") as Extract<ControlOutput, { type: "string" }> | undefined;
}

/**
 * True for push buttons (press = 1, release = 0): flagged by DCS-BIOS, described as
 * "press to …"/"push to …", or listed in the aircraft data. Latching buttons stay toggles.
 */
export function isMomentary(control: Control): boolean {
	if (control.api_variant === "momentary_last_position") return true;
	if ((intOutput(control)?.max_value ?? 0) !== 1) return false;
	return Boolean(control.pushButton) || /\b(press|push) to\b/i.test(control.description);
}

export type LampColour = "green" | "yellow" | "red" | "white" | "blue";

/** Colour suffix of a DCS-BIOS light description, e.g. "(yellow)" or "(light green)". */
const COLOUR_SUFFIX = /\s*\((?:light\s+)?(green|yellow|amber|red|white|blue)\)\s*$/i;

/** The description without its colour: "L BAR (red)" → "L BAR". */
export function stripColour(description: string): string {
	return description.replace(COLOUR_SUFFIX, "").trim();
}

/** The light's colour from its DCS-BIOS description, e.g. "MASTER CAUTION (yellow)". */
export function lampColour(control: Control): LampColour | undefined {
	if (control.knownColour) return control.knownColour;
	const m = COLOUR_SUFFIX.exec(control.description);
	if (!m) return undefined;
	const colour = m[1].toLowerCase();
	return (colour === "amber" ? "yellow" : colour) as LampColour;
}

/** Where a switch's lever points at `value` (middle for the centre and while unknown). */
export function leverAt(control: Control, value: number | undefined): LeverAt {
	const high = control.highEnd ?? "up";
	if (value === intOutput(control)?.max_value) return high;
	if (value === 0) return OPPOSITE[high];
	return "middle";
}

/** A switch's positions as values, from the top (or left) end, like the cockpit. */
export function leverOrder(control: Control): number[] | undefined {
	const max = intOutput(control)?.max_value;
	if (!control.highEnd || max === undefined) return undefined;
	const values = Array.from({ length: max + 1 }, (_, i) => i);
	return control.highEnd === "up" || control.highEnd === "left" ? values.reverse() : values;
}

/** Text for a value: the position name when DCS-BIOS lists one, else ON/OFF or a percentage. */
export function formatValue(control: Control, value: number): string {
	const out = intOutput(control);
	if (control.positions?.[value] !== undefined) return control.positions[value];
	if (!out) return String(value);
	if (out.max_value === 1) return value ? "ON" : "OFF";
	if (out.max_value === 65535) return `${Math.round((value / 65535) * 100)}%`;
	return String(value);
}

/**
 * Command argument for one press of a key, by key mode.
 * Returns undefined when the control cannot do that mode.
 */
export function pressArgument(
	control: Control,
	mode: KeyMode,
	current: number | undefined,
	/** For "cycle": the positions to step through, in order (empty = all). */
	cycle?: number[],
): string | undefined {
	switch (mode) {
		case "toggle":
			if (input(control, "action")?.argument === "TOGGLE") return "TOGGLE";
		// fall through: cycle covers 2-position switches without a TOGGLE action
		case "cycle": {
			const set = input(control, "set_state");
			if (!set) return input(control, "fixed_step") ? "INC" : undefined;
			const all = Array.from({ length: set.max_value + 1 }, (_, i) => i);
			const order = cycle?.filter((v) => v >= 0 && v <= set.max_value) ?? [];
			const steps = order.length ? order : all;
			// From a position outside the list (e.g. a spring-loaded one), go to the first.
			const at = current === undefined ? -1 : steps.indexOf(current);
			return String(steps[(at + 1) % steps.length]);
		}
		case "momentary":
			return "1";
		case "inc":
			return input(control, "fixed_step") ? "INC" : undefined;
		case "dec":
			return input(control, "fixed_step") ? "DEC" : undefined;
	}
}

export type KeyMode = "toggle" | "cycle" | "momentary" | "inc" | "dec";

/** The default key mode for a control. */
export function defaultKeyMode(control: Control): KeyMode {
	if (isMomentary(control)) return "momentary";
	if (input(control, "action")?.argument === "TOGGLE") return "toggle";
	return "cycle";
}

/**
 * Command arguments for turning a dial by `ticks` (negative = counter-clockwise).
 * `step` overrides the DCS-BIOS suggested step for variable_step controls.
 * Fixed-step controls get one INC/DEC per tick.
 */
export function rotateArguments(control: Control, ticks: number, current: number | undefined, step?: number): string[] {
	const variable = input(control, "variable_step");
	if (variable) {
		const delta = Math.round(ticks * (step || variable.suggested_step));
		return [delta >= 0 ? `+${delta}` : String(delta)];
	}
	const set = input(control, "set_state");
	if (set && current !== undefined) {
		return [String(Math.min(set.max_value, Math.max(0, current + ticks)))];
	}
	if (input(control, "fixed_step")) return Array<string>(Math.abs(ticks)).fill(ticks > 0 ? "INC" : "DEC");
	return [];
}
