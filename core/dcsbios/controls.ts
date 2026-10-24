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
	/** A light's colour, where DCS-BIOS gives it as a field (AH-64D) rather than in the description. */
	color?: string;
	/** A control both seats have, shown once: the player's seat picks which seat's control it is. */
	seat?: { position: Control; variants: Control[] };
	/** One seat's own copy of a control both seats have (hidden from the lists; typed identifiers still work). */
	seatVariant?: boolean;
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
	/** From the aircraft data: a switch that turns rather than flips, and which way its highest position is. */
	rotary?: "cw" | "ccw";
	/** 2- and 3-position switches: where the lever points at the highest position, as seen from the seat. */
	highEnd?: LeverEnd;
	/** Positions (values) that spring back when let go, to `rest` (see `springBack`). */
	springs?: number[];
	/** Where a spring-loaded switch comes back to (default: the middle). */
	rest?: number;
	/** A rocker's own push (CYCLIC_RTS → CYCLIC_RTS_PRESS). */
	depress?: string;
	/** A knob that springs back to the middle like a thumb stick (from the aircraft data): its low and high ends. */
	centred?: [string, string];
};

/** A lever's direction as seen from the seat ("up" is forward on the consoles). */
export type LeverEnd = "up" | "down" | "left" | "right";
export type LeverAt = LeverEnd | "middle";

const OPPOSITE: Record<LeverEnd, LeverEnd> = { up: "down", down: "up", left: "right", right: "left" };

export type ControlMap = Map<string, Control>;

/** Two-seat aircraft: what tells the seats' controls apart (see `mergeSeats`). */
export type Seats = {
	/** DCS-BIOS output with the player's seat: 0 for the first seat below, 1 for the second. */
	position: string;
	/** Each seat's identifier, category and description prefix, and its name. */
	seats: { prefix: string; category: string; description: string; name: string }[];
};

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
	if (aircraft.SEATS) mergeSeats(map, aircraft.SEATS);
	for (const c of map.values()) {
		if (aircraft.KNOWN_PUSH_BUTTONS.includes(c.identifier)) c.pushButton = true;
		if (aircraft.KNOWN_COLOURS[c.identifier]) c.knownColour = aircraft.KNOWN_COLOURS[c.identifier];
		if (aircraft.KNOWN_LAMPS[c.identifier]) c.knownLamp = aircraft.KNOWN_LAMPS[c.identifier];
		if (aircraft.LEVER_KNOBS[c.identifier]) c.leverKnob = aircraft.LEVER_KNOBS[c.identifier];
		if (aircraft.ROTARY_KNOBS?.[c.identifier]) c.rotary = aircraft.ROTARY_KNOBS[c.identifier];
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
	for (const c of map.values()) springBack(c, aircraft.SPRING_LOADED?.[c.identifier]);
	for (const [id, ends] of Object.entries(aircraft.CENTRED ?? {})) {
		const c = map.get(id);
		if (c && isKnob(c)) c.centred = [...ends];
	}
	for (const c of map.values()) {
		const push = map.get(`${c.identifier}_PRESS`);
		if (c.springs?.length && push && !push.seatVariant && push.inputs.length > 0) c.depress = push.identifier;
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

/**
 * Two seats, one list: a control both seats have (PLT_KU_ENT, CPG_KU_ENT) becomes one (KU_ENT) that
 * reads and sends as the player's own seat; the seats' own stay for typed identifiers but leave the
 * lists. A control only one seat has keeps its identifier, and its panel is named for the seat.
 */
function mergeSeats(map: ControlMap, { position, seats }: Seats): void {
	const seat = map.get(position);
	if (!seat) return;
	const unprefix = (text: string, prefix: string) => (text.startsWith(prefix) ? text.slice(prefix.length) : text);
	const groups = new Map<string, Control[]>();
	for (const c of map.values()) {
		const i = seats.findIndex((s) => c.identifier.startsWith(s.prefix));
		if (i < 0) continue;
		const base = c.identifier.slice(seats[i].prefix.length);
		const variants = groups.get(base) ?? [];
		variants[i] = c;
		groups.set(base, variants);
	}
	for (const [base, variants] of groups) {
		if (variants.filter(Boolean).length === seats.length && !map.has(base)) {
			const first = variants[0];
			map.set(base, {
				...first,
				identifier: base,
				category: unprefix(first.category, seats[0].category),
				description: unprefix(first.description, seats[0].description),
				positions: first.positions && [...first.positions],
				seat: { position: seat, variants },
			});
			for (const v of variants) v.seatVariant = true;
			continue;
		}
		variants.forEach((c, i) => {
			if (!c) return;
			c.category = `${unprefix(c.category, seats[i].category)} (${seats[i].name})`;
			c.description = unprefix(c.description, seats[i].description);
		});
	}
}

/**
 * Which positions spring back when let go. DCS-BIOS sends a spring-loaded or rocker switch to an end and
 * holds it there until it is sent the middle; those switches take `set_state` 0 to 2 and no INC/DEC.
 * The aircraft data corrects that where ED's own key binds differ (one end latches, other switches spring).
 */
function springBack(c: Control, known: { from: number[]; rest?: number } | undefined): void {
	if (known) {
		c.springs = [...known.from];
		if (known.rest !== undefined) c.rest = known.rest;
		return;
	}
	const set = input(c, "set_state");
	if (set?.max_value === 2 && !input(c, "fixed_step") && intOutput(c)?.max_value === 2) c.springs = [0, 2];
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

/** The light's colour from its DCS-BIOS description, e.g. "MASTER CAUTION (yellow)", or its colour field. */
export function lampColour(control: Control): LampColour | undefined {
	if (control.knownColour) return control.knownColour;
	const colour = (COLOUR_SUFFIX.exec(control.description)?.[1] ?? control.color)?.toLowerCase();
	if (!colour || !/^(green|yellow|amber|red|white|blue)$/.test(colour)) return undefined;
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

/** Where a spring-loaded switch comes back to when let go. */
export function restOf(control: Control): number {
	return control.rest ?? ((intOutput(control)?.max_value ?? 0) === 2 ? 1 : 0);
}

/** A knob that turns through a range (volume, brightness) rather than clicking between positions. */
export function isKnob(control: Control): boolean {
	return input(control, "variable_step") !== undefined;
}

/**
 * What a key press can do: `set:N` puts a switch in position N, `hold:N` holds a spring-loaded one there
 * while pressed, `depress` pushes a rocker's own button, `inc`/`dec` step or turn, `push:low`/`push:high`
 * deflect a thumb stick while pressed (centred on release), `cycle` steps through positions, `toggle` flips,
 * `momentary` presses 1 and releases 0.
 */
export type KeyMode =
	| "toggle"
	| "cycle"
	| "momentary"
	| "inc"
	| "dec"
	| "depress"
	| "push:low"
	| "push:high"
	| `set:${number}`
	| `hold:${number}`;

/** "set:2" → ["set", 2]. */
function positionMode(mode: string): ["set" | "hold", number] | undefined {
	const m = /^(set|hold):(\d+)$/.exec(mode);
	return m ? [m[1] as "set" | "hold", Number(m[2])] : undefined;
}

/** A position's name: DCS-BIOS's or the aircraft data's, else the way the lever points (Up, Left, Centre). */
export function positionName(control: Control, value: number): string {
	const named = control.positions?.[value];
	if (named) return named;
	if (control.highEnd) {
		const at = leverAt(control, value);
		return at === "middle" ? "Centre" : at[0].toUpperCase() + at.slice(1);
	}
	return String(value);
}

/** Positions a key can set (not those that spring back), from the top or left like the cockpit. */
export function latchedPositions(control: Control): number[] {
	const max = intOutput(control)?.max_value;
	if (!input(control, "set_state") || isKnob(control) || max === undefined || max > 20) return [];
	const values = leverOrder(control) ?? Array.from({ length: max + 1 }, (_, i) => i);
	const springs = control.springs ?? [];
	// A rocker that springs back from both ends has nothing to set: its middle is where it rests anyway.
	const latched = values.filter((v) => !springs.includes(v));
	return latched.length === 1 && springs.length > 0 ? [] : latched;
}

/** The modes a key on this control can use, in the order the settings list them, with their names. */
export function keyModes(control: Control): { mode: KeyMode; label: string }[] {
	const modes: { mode: KeyMode; label: string }[] = [];
	if (isMomentary(control)) return [{ mode: "momentary", label: "Press (hold 1, release 0)" }];
	const max = intOutput(control)?.max_value;
	// A push with nothing to read back (CYCLIC_RTS_PRESS).
	if (max === undefined && input(control, "action")?.argument === "TOGGLE") return [{ mode: "toggle", label: "Press" }];
	const order = leverOrder(control) ?? (max !== undefined && max <= 20 ? Array.from({ length: max + 1 }, (_, i) => i) : []);
	const latched = latchedPositions(control);
	for (const v of order) {
		if (control.springs?.includes(v)) modes.push({ mode: `hold:${v}`, label: `Hold ${positionName(control, v)}` });
		else if (latched.includes(v)) modes.push({ mode: `set:${v}`, label: `Set ${positionName(control, v)}` });
	}
	if (control.depress) modes.push({ mode: "depress", label: "Depress" });
	if (max === 1 && latched.length === 2) modes.push({ mode: "toggle", label: "Toggle" });
	if ((max ?? 0) >= 2 && latched.length >= 2) modes.push({ mode: "cycle", label: "Next position (wraps)" });
	if (control.centred) {
		// Turning would leave it deflected: a key pushes while held, like a thumb.
		modes.push({ mode: "push:high", label: `Push ${control.centred[1]}` }, { mode: "push:low", label: `Push ${control.centred[0]}` });
	} else if (isKnob(control)) {
		modes.push({ mode: "inc", label: "Turn up" }, { mode: "dec", label: "Turn down" });
	} else if (input(control, "fixed_step") && !control.springs?.length && (max === undefined || max >= 2)) {
		// One notch at a time, no wrapping. Not on spring-loaded switches: a step would leave them held.
		modes.push({ mode: "inc", label: "Step up" }, { mode: "dec", label: "Step down" });
	}
	if (max === 1 && !control.springs?.length) modes.push({ mode: "momentary", label: "Hold (press 1, release 0)" });
	return modes;
}

/**
 * Command argument for one press of a key, by key mode.
 * Returns undefined when the control cannot do that mode.
 */
export function pressArgument(
	control: Control,
	mode: KeyMode,
	current: number | undefined,
	/** For "cycle": the positions to step through, in order (empty = every position that stays put). */
	cycle?: number[],
): string | undefined {
	const position = positionMode(mode);
	if (position) {
		const set = input(control, "set_state");
		return set && position[1] <= set.max_value ? String(position[1]) : undefined;
	}
	switch (mode) {
		case "toggle":
			if (input(control, "action")?.argument === "TOGGLE") return "TOGGLE";
		// fall through: cycle covers 2-position switches without a TOGGLE action
		case "cycle": {
			const set = input(control, "set_state");
			if (!set) return input(control, "fixed_step") ? "INC" : undefined;
			const all = Array.from({ length: set.max_value + 1 }, (_, i) => i);
			const order = cycle?.filter((v) => v >= 0 && v <= set.max_value) ?? [];
			const latched = all.filter((v) => !control.springs?.includes(v));
			const steps = order.length ? order : latched.length ? latched : all;
			// From a position outside the list (e.g. a spring-loaded one), go to the first.
			const at = current === undefined ? -1 : steps.indexOf(current);
			return String(steps[(at + 1) % steps.length]);
		}
		case "momentary":
			return "1";
		case "inc":
		case "dec": {
			const sign = mode === "inc" ? "+" : "-";
			if (isKnob(control)) return `${sign}${knobStep(control, TAP)}`;
			return input(control, "fixed_step") ? mode.toUpperCase() : undefined;
		}
		case "push:low":
		case "push:high":
			return control.centred ? String(pushValue(control, mode, 0)) : undefined;
		case "depress":
			return undefined;
	}
	return undefined;
}

/** The middle of a centred knob's range. */
export function centreOf(control: Control): number {
	return Math.round((input(control, "set_state")?.max_value ?? 65535) / 2);
}

/** A thumb-stick push held for `heldMs`: from the middle towards the pushed end, by `pushRamp`. */
export function pushValue(control: Control, mode: "push:low" | "push:high", heldMs: number): number {
	const centre = centreOf(control);
	const reach = Math.round((mode === "push:high" ? (input(control, "set_state")?.max_value ?? 65535) - centre : centre) * pushRamp(heldMs));
	return mode === "push:high" ? centre + reach : centre - reach;
}

/**
 * How far a held Push key deflects a thumb stick (share of the way to the end): a gentle 20% for the
 * first 300 ms (a short press nudges the cursor), then smoothly to 100% over the next 1.2 s.
 */
export function pushRamp(heldMs: number): number {
	const t = Math.min(1, Math.max(0, (heldMs - 300) / 1200));
	return 0.2 + 0.8 * t * t * (3 - 2 * t);
}

/** Command argument when the key is let go, if any: a held switch springs back, a pressed button lifts. */
export function releaseArgument(control: Control, mode: KeyMode): string | undefined {
	if (positionMode(mode)?.[0] === "hold") return String(restOf(control));
	if (mode === "momentary") return "0";
	if ((mode === "push:low" || mode === "push:high") && control.centred) return String(centreOf(control));
	return undefined;
}

/** Share of a knob's range for one short press. */
const TAP = 0.02;

/** A knob step of `share` of its range (at least 1). */
export function knobStep(control: Control, share: number): number {
	const range = input(control, "variable_step")?.max_value ?? 65535;
	return Math.max(1, Math.round(range * share));
}

/**
 * Turning a knob from a held key: nothing for the first 300 ms (a short press is one small step),
 * then a step every 40 ms that grows smoothly from 1% to 5% of the range over the next 1.2 s.
 * Returns the share of the range to turn for a tick at `heldMs`, or 0 for none.
 */
export function knobRamp(heldMs: number): number {
	const t = (heldMs - 300) / 1200;
	if (t < 0) return 0;
	const eased = Math.min(1, t) ** 2 * (3 - 2 * Math.min(1, t));
	return 0.01 + 0.04 * eased;
}

/** Positions for INC/DEC from a held key: first repeat after 400 ms, then quicker, down to every 120 ms. */
export function stepInterval(heldMs: number): number {
	const t = Math.min(1, Math.max(0, (heldMs - 400) / 1500));
	return Math.round(400 - 280 * t * t * (3 - 2 * t));
}

/** The default key mode for a control. */
export function defaultKeyMode(control: Control): KeyMode {
	if (isMomentary(control)) return "momentary";
	if (input(control, "action")?.argument === "TOGGLE") return "toggle";
	if (control.centred) return "push:high";
	if (isKnob(control)) return "inc";
	// A rocker that springs back from every end: hold its first end (top or left).
	if (control.springs?.length && latchedPositions(control).length === 0) {
		const first = (leverOrder(control) ?? control.springs).find((v) => control.springs!.includes(v));
		if (first !== undefined) return `hold:${first}`;
	}
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
