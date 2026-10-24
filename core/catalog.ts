/**
 * The control list as the pickers show it: grouped by cockpit panel, with a
 * suggested light for switches that have their own lamp.
 */
import type { Control, ControlMap } from "./dcsbios/controls.ts";
import { actionName, controlName, defaultKeyMode, input, intOutput, keyModes, lampColour, latchedPositions, leverOrder, stripColour } from "./dcsbios/controls.ts";

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
	/** What a key press can do ("Press does"), Automatic and Custom aside. */
	modes?: { value: string; label: string }[];
	/** What Automatic does for this control (a `modes` value). */
	auto?: string;
	/** Positions "Next position" can step through (those that stay put), top first. */
	cycle?: number[];
	/**
	 * One bind of a control, listed under it the way DCS lists its key binds ("PTT/RTS Switch - ICS"):
	 * picking it sets the key's control and mode. `id` is a name for the list only.
	 */
	action?: { control: string; mode: string };
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
	const items: { item: PickerItem; control: Control }[] = [];
	for (const c of controls.values()) {
		if (c.seatVariant) continue;
		const entry = familyEntry(c, controls);
		if (entry.skip) continue;
		const max = intOutput(c)?.max_value;
		const set = input(c, "set_state");
		items.push({
			control: c,
			item: {
				id: c.identifier,
				category: c.category,
				// DCS-BIOS ends some names with a dash ("PTT/RTS Switch -").
				description: entry.description.replace(/\s+-$/, ""),
				positions: c.positions,
				order: leverOrder(c),
				maxValue: max,
				key: c.inputs.length > 0,
				dial: Boolean(input(c, "variable_step")) || (set !== undefined && set.max_value >= 2),
				led: c.control_type === "led",
				lamp: suggestLamp(c, controls),
				...(c.inputs.length > 0 && {
					modes: keyModes(c).map(({ mode, label }) => ({ value: mode, label })),
					auto: defaultKeyMode(c),
					cycle: latchedPositions(c),
				}),
			},
		});
	}
	items.sort((a, b) => a.item.category.localeCompare(b.item.category) || a.item.description.localeCompare(b.item.description));
	const ids = new Set(items.map(({ item }) => item.id));
	return items.flatMap(({ item, control }) => [item, ...actionEntries(control, item, ids)]);
}

/** A control's binds, each as its own list entry right under it, like DCS's key bind list. */
function actionEntries(c: Control, parent: PickerItem, ids: Set<string>): PickerItem[] {
	const modes = keyModes(c);
	if (modes.length < 2) return [];
	const entries: PickerItem[] = [];
	for (const { mode } of modes) {
		const name = actionName(c, mode);
		// Depress is DCS-BIOS's own control (CYCLIC_RTS_PRESS), already in the list right after these.
		if (!name || mode === "depress") continue;
		let id = `${c.identifier}_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
		if (ids.has(id)) id = `${c.identifier}_${mode.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
		ids.add(id);
		entries.push({
			id,
			category: parent.category,
			description: `${controlName(c)} - ${name}`,
			key: true,
			dial: false,
			led: false,
			lamp: parent.lamp,
			action: { control: c.identifier, mode },
		});
	}
	return entries;
}

/** The list entry for a key's control and mode: its bind's entry when it has one, else the control. */
export function pickedId(items: PickerItem[], control: string | undefined, mode: string | undefined): string {
	if (!control) return "";
	return items.find((i) => i.action?.control === control && i.action.mode === mode)?.id ?? control;
}

/** A short dial label from an identifier: LEFT_DDI_BRT_CTL → "LEFT DDI BRT". */
export function dialLabel(id: string): string {
	return id
		.replace(/_(CTL|SW|KNOB|KNB|LVR|DIMMER|CONTROL)$/, "")
		.replace(/_/g, " ")
		.slice(0, 14)
		.trim();
}
