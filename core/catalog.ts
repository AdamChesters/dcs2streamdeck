/**
 * The control list as the pickers show it: grouped by cockpit panel, with a
 * suggested light for switches that have their own lamp.
 */
import type { Control, ControlMap } from "./dcsbios/controls.ts";
import { input, intOutput, lampColour, leverOrder, stripColour } from "./dcsbios/controls.ts";

export type PickerItem = {
	id: string;
	/** Cockpit panel (DCS-BIOS category). */
	category: string;
	description: string;
	positions?: string[];
	/** Positions (as numbers) from the top or left, like the cockpit. */
	order?: number[];
	/** Highest position number (1 for on/off switches). */
	maxValue?: number;
	/** Usable on a key (has an input). */
	key: boolean;
	/** Usable on a dial (turns through a range or 3+ positions). */
	dial: boolean;
	/** A lamp (indicator light). */
	led: boolean;
	/** Suggested "Light the key from" control. */
	lamp?: string;
};

const NOISE = new Set(["SW", "BTN", "LT", "L", "SWITCH", "LIGHT", "LEVER", "KNOB", "SEL", "LAMP"]);
const words = (id: string) => id.split("_").filter((w) => w && !NOISE.has(w));

/**
 * The light that belongs to a switch: a known pair, else a lamp on the same
 * panel sharing at least two name words (e.g. MASTER_MODE_AA → MASTER_MODE_AA_LT,
 * SJ_CTR → SJ_CTR_LT, LEFT_FIRE_BTN → FIRE_LEFT_LT).
 */
export function suggestLamp(control: Control, controls: ControlMap): string | undefined {
	const known = control.knownLamp;
	if (known && controls.has(known)) return known;
	if (control.control_type === "led" || control.inputs.length === 0) return undefined;
	const mine = new Set(words(control.identifier));
	let best: string | undefined;
	let bestScore = 1;
	for (const c of controls.values()) {
		if (c.control_type !== "led" || c.category !== control.category) continue;
		const score = words(c.identifier).filter((w) => mine.has(w)).length;
		if (score > bestScore) {
			best = c.identifier;
			bestScore = score;
		}
	}
	return best;
}

/**
 * One picker entry per cockpit light: "L BAR (green / red)" instead of one entry
 * per colour, "AOA Indexer (green / yellow / red)" for the indexer's three parts.
 */
function familyEntry(c: Control, controls: ControlMap): { skip: boolean; description: string } {
	const family = c.family;
	if (!family || family.length < 2) return { skip: false, description: c.description };
	if (family[0] !== c.identifier) return { skip: true, description: "" };
	const members = family.map((id) => controls.get(id)).filter((m): m is Control => m !== undefined);
	const legends = members.map((m) => stripColour(m.description).split(/\s+/));
	const common: string[] = [];
	for (let i = 0; legends.every((words) => words[i] !== undefined && words[i] === legends[0][i]); i++) common.push(legends[0][i]);
	const colours = [...new Set(members.map((m) => lampColour(m) ?? "light"))];
	const name = c.familyName ?? (common.join(" ") || legends[0].join(" "));
	return { skip: false, description: `${name} (${colours.join(" / ")})` };
}

export function catalog(controls: ControlMap): PickerItem[] {
	const items: PickerItem[] = [];
	for (const c of controls.values()) {
		const entry = familyEntry(c, controls);
		if (entry.skip) continue;
		const max = intOutput(c)?.max_value;
		const set = input(c, "set_state");
		items.push({
			id: c.identifier,
			category: c.category,
			description: entry.description,
			positions: c.positions,
			order: leverOrder(c),
			maxValue: max,
			key: c.inputs.length > 0,
			dial: Boolean(input(c, "variable_step")) || (set !== undefined && set.max_value >= 2),
			led: c.control_type === "led",
			lamp: suggestLamp(c, controls),
		});
	}
	return items.sort((a, b) => a.category.localeCompare(b.category) || a.description.localeCompare(b.description));
}

/** A short dial label from an identifier: LEFT_DDI_BRT_CTL → "LEFT DDI BRT". */
export function dialLabel(id: string): string {
	return id
		.replace(/_(CTL|SW|KNOB|KNB|LVR|DIMMER|CONTROL)$/, "")
		.replace(/_/g, " ")
		.slice(0, 14)
		.trim();
}
