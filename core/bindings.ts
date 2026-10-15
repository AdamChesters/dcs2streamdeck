/**
 * What a key or dial does and shows. Shared by the Stream Deck plugin and the standalone app.
 */
import type { Control, KeyMode } from "./dcsbios/controls.ts";
import { defaultKeyMode, formatValue, intOutput, isMomentary, lampColour, pressArgument, RESTING, rotateArguments, stripColour } from "./dcsbios/controls.ts";
import { LEVER_KNOBS } from "./aircraft.data.ts";
import type { Colour, DialView, Glyph, KeyLook, Light } from "./render.ts";

/** The part of the DCS-BIOS client the bindings use. */
export type Dcs = {
	/** True when DCS is sending data for this plugin's aircraft. */
	readonly connected: boolean;
	/** Key text when not connected, e.g. "NO DCS" or "NO F-16C". */
	readonly offline?: string;
	read(control: Control): number | string | undefined;
	send(identifier: string, argument: string): void;
};

export type Lookup = (identifier: string | undefined) => Control | undefined;

export type KeySettings = {
	/** DCS-BIOS identifier to send to, e.g. APU_CONTROL_SW. */
	control?: string;
	/** Text on the key. Empty = the control's description. */
	title?: string;
	/** "" = automatic; "custom" uses `press` / `release`. */
	mode?: KeyMode | "custom" | "";
	press?: string;
	release?: string;
	/** Identifier whose value lights the key, e.g. APU_READY_LT. Empty = `control`. */
	lamp?: string;
	/** Light the key when the lamp control is off. */
	invert?: boolean;
	/** "Next position": the positions a press steps through (empty = all). */
	cycle?: number[];
};

export type DialSettings = {
	/** One knob per line: `IDENTIFIER | Label | step` (label and step optional). */
	functions?: string;
};

export type DialFunction = { identifier: string; label: string; step?: number };

/** Every light of a cockpit light: L BAR green + red, the three AOA indexer lights, or just itself. */
function lightsOf(lamp: Control | undefined, lookup: Lookup): Control[] {
	if (!lamp) return [];
	return (lamp.family ?? [lamp.identifier]).map(lookup).filter((c): c is Control => c !== undefined);
}

/** The controls a key watches: its own switch (text) and all of its light (highlight). */
export function keyWatches(s: KeySettings, lookup: Lookup): Control[] {
	const c = lookup(s.control);
	const lamp = lookup(s.lamp) ?? c;
	return [c, ...lightsOf(lamp, lookup)].filter((x, i, all): x is Control => x !== undefined && all.indexOf(x) === i);
}

const SEVERITY: Colour[] = ["red", "yellow", "green", "white", "blue"];

/**
 * The text shows the key's own control (e.g. the APU switch). The highlight
 * follows "Light the key from" when set (e.g. APU READY), else the same control.
 * A light with several colours (L BAR) lights in the most severe colour that is on.
 */
export function keyLook(s: KeySettings, lookup: Lookup, dcs: Dcs): KeyLook {
	const c = lookup(s.control);
	const lamp = lookup(s.lamp) ?? c;
	const value = c ? dcs.read(c) : undefined;
	const lights = lightsOf(lamp, lookup).map((l) => {
		const v = dcs.read(l);
		return { control: l, on: typeof v === "number" && isLit(l, v), colour: lampColour(l) ?? "green" };
	});
	const onColours = lights.filter((l) => l.on).map((l) => l.colour);
	const colour = SEVERITY.find((x) => onColours.includes(x)) ?? (lamp ? lampColour(lamp) : undefined);
	const anyOn = onColours.length > 0;

	// A light-only key (no switch): name and picture come from the light.
	if (!c && !s.control && lamp) {
		const title = s.title?.trim() || shortName(lamp);
		return {
			title,
			state: anyOn ? "ON" : "OFF",
			lit: anyOn !== Boolean(s.invert),
			live: dcs.connected,
			offline: dcs.offline,
			colour,
			glyph: lightGlyph(lights, title),
		};
	}
	// A push button with its own light (MASTER CAUTION, fire buttons): the text shows the light.
	const showLight = c !== undefined && isMomentary(c) && lamp !== undefined && lamp !== c;
	return {
		title: s.title?.trim() || (c ? shortName(c) : s.control || "SET UP"),
		state: showLight
			? anyOn
				? "ON"
				: "OFF"
			: c
				? typeof value === "number"
					? formatValue(c, value)
					: String(value ?? "")
				: s.control
					? "NO CONTROL"
					: "",
		lit: lamp !== undefined && anyOn !== Boolean(s.invert),
		live: dcs.connected,
		offline: dcs.offline,
		colour,
		glyph: c ? switchGlyph(c, typeof value === "number" ? value : undefined) : undefined,
	};
}

function lightGlyph(lights: { control: Control; on: boolean; colour: Colour }[], legend: string): Glyph {
	const light = (l: { on: boolean; colour: Colour } | undefined): Light => ({ on: Boolean(l?.on), colour: l?.colour ?? "green" });
	const indicator = lights[0]?.control.indicator;
	if (indicator) {
		const role = (name: string) => light(lights.find((l) => l.control.identifier === indicator.roles[name]));
		if (indicator.kind === "aoa") return { kind: "aoa", high: role("high"), normal: role("normal"), low: role("low") };
		if (indicator.kind === "flaps") return { kind: "flaps", half: role("half"), full: role("full"), flaps: role("flaps") };
		if (indicator.kind === "gear") return { kind: "gear", nose: role("nose"), left: role("left"), right: role("right"), handle: role("handle") };
	}
	const legends = new Set(lights.map((l) => shortName(l.control).toUpperCase()));
	if (legends.size <= 1) return { kind: "lens", legend: legend.toUpperCase(), lights: lights.map(light) };
	return { kind: "stack", lights: lights.map(light) };
}

/** The picture for a switch, from its type and position count. */
function switchGlyph(c: Control, value: number | undefined): Glyph | undefined {
	const max = intOutput(c)?.max_value ?? 0;
	if (isMomentary(c)) return { kind: "button", pressed: value === 1 };
	if (max === 1 && /_COVER$/.test(c.identifier)) return { kind: "guard", open: value === 1 };
	if (max === 1) {
		const knob = LEVER_KNOBS[c.identifier];
		return knob ? { kind: "toggle", up: value === 1, knob } : { kind: "toggle", up: value === 1 };
	}
	if (max === 2) {
		const horizontal = (c.positions ?? []).some((p) => /^(LEFT|RIGHT|L|R)$/i.test(p));
		return { kind: "three", position: value ?? 1, horizontal };
	}
	if (max >= 3 && max <= 11) return { kind: "rotary", position: value ?? 0, count: max + 1 };
	return undefined;
}

/** Sends the key-press command. Returns false when the key cannot act (show an alert). */
export function keyDown(s: KeySettings, lookup: Lookup, dcs: Dcs): boolean {
	const c = lookup(s.control);
	// A light-only key has nothing to press.
	if (!c) return !s.control && Boolean(lookup(s.lamp));
	const mode = s.mode || defaultKeyMode(c);
	const current = dcs.read(c);
	const argument =
		mode === "custom" ? s.press?.trim() : pressArgument(c, mode, typeof current === "number" ? current : undefined, s.cycle);
	if (!argument) return false;
	dcs.send(c.identifier, argument);
	return true;
}

export function keyUp(s: KeySettings, lookup: Lookup, dcs: Dcs): void {
	const c = lookup(s.control);
	if (!c) return;
	const mode = s.mode || defaultKeyMode(c);
	if (mode === "momentary") dcs.send(c.identifier, "0");
	if (mode === "custom" && s.release?.trim()) dcs.send(c.identifier, s.release.trim());
}

export function parseFunctions(text: string | undefined): DialFunction[] {
	return (text ?? "")
		.split(/\r?\n/)
		.map((line) => line.split("|").map((part) => part.trim()))
		.filter(([identifier]) => identifier)
		.map(([identifier, label, step]) => ({
			identifier,
			label: label || identifier,
			step: step && Number(step) > 0 ? Number(step) : undefined,
		}));
}

export function dialView(functions: DialFunction[], index: number, lookup: Lookup, dcs: Dcs): DialView {
	const fn = functions[index];
	const c = lookup(fn?.identifier);
	const value = c ? dcs.read(c) : undefined;
	const live = dcs.connected;
	const count = functions.length > 1 ? ` ${index + 1}/${functions.length}` : "";
	const title = fn ? `${fn.label}${count}` : "SET UP";
	const text = !fn
		? "add knobs"
		: !c
			? "NO CONTROL"
			: !live
				? (dcs.offline ?? "NO DCS")
				: typeof value === "number"
					? formatValue(c, value)
					: String(value ?? "");
	const percent = c && typeof value === "number" ? Math.round((value / (intOutput(c)?.max_value || 1)) * 100) : 0;
	return { title, value: text, percent, functions: functions.map((f) => f.label), index, live };
}

/** Sends the commands for turning a dial. Returns false when the dial cannot act. */
export function dialRotate(fn: DialFunction | undefined, ticks: number, lookup: Lookup, dcs: Dcs): boolean {
	const c = lookup(fn?.identifier);
	if (!fn || !c) return false;
	const current = dcs.read(c);
	for (const argument of rotateArguments(c, ticks, typeof current === "number" ? current : undefined, fn.step)) {
		dcs.send(c.identifier, argument);
	}
	return true;
}

/** A switch is lit unless it is in its resting position (OFF, SAFE, RETRACT, NORM…), else unless at 0. */
function isLit(c: Control, value: number): boolean {
	const names = (c.positions ?? []).map((p) => p.toUpperCase());
	for (const word of RESTING) {
		const at = names.indexOf(word);
		if (at >= 0) return value !== at;
	}
	return value > 0 && (intOutput(c)?.max_value ?? 1) > 0;
}

/** "APU Control Switch, ON/OFF" → "APU Control Switch"; "L BAR (red)" → "L BAR". */
function shortName(c: Control): string {
	return stripColour(c.description.split(",")[0].replace(/\s*-.*$/, ""));
}
