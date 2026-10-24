/**
 * What a key or dial does and shows. Shared by the Stream Deck plugin and the standalone app.
 */
import type { Control, KeyMode } from "./dcsbios/controls.ts";
import {
	defaultKeyMode,
	formatValue,
	input,
	intOutput,
	isKnob,
	isMomentary,
	knobRamp,
	knobStep,
	lampColour,
	leverAt,
	pressArgument,
	pushValue,
	releaseArgument,
	RESTING,
	rotateArguments,
	stepInterval,
	stripColour,
} from "./dcsbios/controls.ts";
import type { Colour, DialView, Glyph, KeyLook, Light } from "./render.ts";

/** The part of the DCS-BIOS client the bindings use. */
export type Dcs = {
	/** True when DCS is sending data for this key's aircraft. */
	readonly connected: boolean;
	/** Key text when not connected: "NO DCS", or the key's aircraft (e.g. "F-16C") while DCS flies another. */
	readonly offline?: string;
	read(control: Control): number | string | undefined;
	send(identifier: string, argument: string): void;
};

export type Lookup = (identifier: string | undefined) => Control | undefined;

export type KeySettings = {
	/** Aircraft ID (aircraft/<id>), e.g. "f16c". None = see aircraftOf in aircraft.data.ts. */
	aircraft?: string;
	/** DCS-BIOS identifier to send to, e.g. APU_CONTROL_SW. */
	control?: string;
	/** Text on the key. Empty = the control's description. */
	title?: string;
	/** "" = automatic (see defaultKeyMode); "custom" uses `press` / `release`. */
	mode?: KeyMode | "custom" | "";
	press?: string;
	release?: string;
	/** Identifier whose value lights the key, e.g. APU_READY_LT. Empty = `control`. */
	lamp?: string;
	/** Light the key when the lamp control is off. */
	invert?: boolean;
	/** "Next position": the positions a press steps through (empty = all that stay put). */
	cycle?: number[];
};

export type DialSettings = {
	/** Aircraft ID, as for keys. */
	aircraft?: string;
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
	// Knobs turn clockwise to their highest position, unless the aircraft data says otherwise.
	const turned = c.rotary === "ccw" && value !== undefined ? max - value : (value ?? 0);
	if (isMomentary(c)) return { kind: "button", pressed: value === 1 };
	if (max === 1 && /_(COVER|CVR)$/.test(c.identifier)) return { kind: "guard", open: value === 1 };
	// 3-position knobs (DDI brightness: OFF/NIGHT/DAY) turn rather than flip.
	if (max === 2 && (c.rotary || /\bknob\b/i.test(c.description))) return { kind: "rotary", position: turned, count: 3 };
	if (max === 1 || max === 2) {
		const at = leverAt(c, value);
		return c.leverKnob ? { kind: "lever", at, knob: c.leverKnob } : { kind: "lever", at };
	}
	if (max >= 3 && max <= 11) return { kind: "rotary", position: turned, count: max + 1 };
	return undefined;
}

/** Sends the key-press command. Returns false when the key cannot act (show an alert). */
export function keyDown(s: KeySettings, lookup: Lookup, dcs: Dcs): boolean {
	const c = lookup(s.control);
	// A light-only key has nothing to press.
	if (!c) return !s.control && Boolean(lookup(s.lamp));
	const mode = s.mode || defaultKeyMode(c);
	if (mode === "depress") {
		const push = lookup(c.depress);
		if (!push) return false;
		dcs.send(push.identifier, input(push, "set_state") ? "1" : "TOGGLE");
		return true;
	}
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
	if (mode === "depress") {
		const push = lookup(c.depress);
		if (push && input(push, "set_state")) dcs.send(push.identifier, "0");
		return;
	}
	if (mode === "custom") {
		if (s.release?.trim()) dcs.send(c.identifier, s.release.trim());
		return;
	}
	const argument = releaseArgument(c, mode);
	if (argument) dcs.send(c.identifier, argument);
}

/**
 * While a Step/Turn/Push key is held, keeps going after `keyDown`'s first step: a knob turns on a smooth curve
 * (small steps at first, then faster), a stepped switch repeats quicker the longer it is held, a thumb stick
 * is pushed further.
 * Returns the function that stops it (call on key up), or undefined when the key does not repeat.
 */
export function keyHold(s: KeySettings, lookup: Lookup, dcs: Dcs, now = () => Date.now()): (() => void) | undefined {
	const c = lookup(s.control);
	const mode = c && (s.mode || defaultKeyMode(c));
	if (c && (mode === "push:low" || mode === "push:high") && c.centred) {
		// A thumb stick: push harder the longer the key is held (keyUp centres it).
		const start = now();
		let sent = pressArgument(c, mode, undefined);
		let timer: ReturnType<typeof setTimeout>;
		const tick = (): void => {
			const value = String(pushValue(c, mode, now() - start));
			if (value !== sent) dcs.send(c.identifier, value);
			sent = value;
			timer = setTimeout(tick, 40);
		};
		timer = setTimeout(tick, 40);
		return () => clearTimeout(timer);
	}
	if (!c || (mode !== "inc" && mode !== "dec")) return undefined;
	if (!isKnob(c) && !input(c, "fixed_step")) return undefined;
	const sign = mode === "inc" ? "+" : "-";
	const start = now();
	let timer: ReturnType<typeof setTimeout>;
	const tick = (): void => {
		const held = now() - start;
		if (isKnob(c)) {
			const share = knobRamp(held);
			if (share > 0) dcs.send(c.identifier, `${sign}${knobStep(c, share)}`);
			timer = setTimeout(tick, 40);
		} else {
			if (held >= 400) dcs.send(c.identifier, mode.toUpperCase());
			timer = setTimeout(tick, held >= 400 ? stepInterval(held) : 400 - held);
		}
	};
	timer = setTimeout(tick, isKnob(c) ? 40 : 400);
	return () => clearTimeout(timer);
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
