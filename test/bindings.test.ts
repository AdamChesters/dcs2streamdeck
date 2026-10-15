import assert from "node:assert/strict";
import { test } from "node:test";

import type { Dcs } from "../src/core/bindings.ts";
import { keyDown, keyLook, keyUp, keyWatches } from "../src/core/bindings.ts";
import { keySvg } from "../src/core/render.ts";
import { loadControls } from "../src/core/dcsbios/controls.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname);
const lookup = (id: string | undefined) => (id ? controls.get(id) : undefined);
const dcs = (values: Record<string, number>): Dcs => ({
	connected: true,
	read: (c) => values[c.identifier],
	send: () => {},
});

test("with a lamp, the text follows the switch and the highlight follows the lamp", () => {
	const s = { control: "APU_CONTROL_SW", lamp: "APU_READY_LT", title: "APU" };
	assert.deepEqual(
		{ ...keyLook(s, lookup, dcs({ APU_CONTROL_SW: 1, APU_READY_LT: 0 })), title: undefined },
		{ title: undefined, state: "ON", lit: false, live: true, offline: undefined, colour: "green", glyph: { kind: "toggle", up: true } },
		"switch on, APU spooling: ON but not highlighted",
	);
	assert.equal(keyLook(s, lookup, dcs({ APU_CONTROL_SW: 1, APU_READY_LT: 1 })).lit, true, "APU READY: highlighted");
	assert.equal(keyLook(s, lookup, dcs({ APU_CONTROL_SW: 0, APU_READY_LT: 0 })).state, "OFF", "jet released the switch");
	assert.deepEqual(
		keyWatches(s, lookup).map((c) => c.identifier),
		["APU_CONTROL_SW", "APU_READY_LT"],
		"redraws when either changes",
	);
});

test("without a lamp, text and highlight both follow the switch", () => {
	const look = keyLook({ control: "APU_CONTROL_SW" }, lookup, dcs({ APU_CONTROL_SW: 1 }));
	assert.equal(look.state, "ON");
	assert.equal(look.lit, true);
	assert.equal(keyWatches({ control: "APU_CONTROL_SW" }, lookup).length, 1);
});

test("master caution: press resets, key lights yellow with the caution light", () => {
	const s = { control: "MASTER_CAUTION_RESET_SW", lamp: "MASTER_CAUTION_LT" };
	const look = keyLook(s, lookup, dcs({ MASTER_CAUTION_RESET_SW: 0, MASTER_CAUTION_LT: 1 }));
	assert.equal(look.lit, true);
	assert.equal(look.colour, "yellow");
	assert.equal(look.state, "ON", "the text shows the caution light, not the released button");
	assert.equal(keyLook(s, lookup, dcs({ MASTER_CAUTION_RESET_SW: 0, MASTER_CAUTION_LT: 0 })).state, "OFF");
	const sent: string[] = [];
	const live = { ...dcs({ MASTER_CAUTION_RESET_SW: 0 }), send: (id: string, arg: string) => void sent.push(`${id} ${arg}`) };
	assert.equal(keyDown(s, lookup, live), true);
	keyUp(s, lookup, live);
	assert.deepEqual(sent, ["MASTER_CAUTION_RESET_SW 1", "MASTER_CAUTION_RESET_SW 0"], "push and release");
});

test("light-only key (L BAR): shows the light in red, press does nothing", () => {
	const s = { lamp: "LH_ADV_L_BAR_RED" };
	const on = keyLook(s, lookup, dcs({ LH_ADV_L_BAR_RED: 1 }));
	assert.deepEqual({ title: on.title, lit: on.lit, colour: on.colour }, { title: "L BAR", lit: true, colour: "red" });
	assert.equal(keyLook(s, lookup, dcs({ LH_ADV_L_BAR_RED: 0 })).lit, false);
	const sent: string[] = [];
	assert.equal(keyDown(s, lookup, { ...dcs({}), send: (id) => void sent.push(id) }), true, "no alert");
	assert.deepEqual(sent, []);
});

test("L BAR: one key shows both colours of the one light, red first", () => {
	const s = { lamp: "LH_ADV_L_BAR_GREEN" };
	assert.deepEqual(keyWatches(s, lookup).map((c) => c.identifier).sort(), ["LH_ADV_L_BAR_GREEN", "LH_ADV_L_BAR_RED"]);
	const green = keyLook(s, lookup, dcs({ LH_ADV_L_BAR_GREEN: 1, LH_ADV_L_BAR_RED: 0 }));
	assert.equal(green.colour, "green");
	assert.equal(green.glyph?.kind, "lens");
	if (green.glyph?.kind === "lens") {
		assert.equal(green.glyph.legend, "L BAR");
		assert.deepEqual([...green.glyph.lights].sort((a, b) => a.colour.localeCompare(b.colour)), [
			{ on: true, colour: "green" },
			{ on: false, colour: "red" },
		]);
	}
	assert.equal(keyLook(s, lookup, dcs({ LH_ADV_L_BAR_GREEN: 1, LH_ADV_L_BAR_RED: 1 })).colour, "red", "red wins when both are on");
	assert.equal(keyLook(s, lookup, dcs({ LH_ADV_L_BAR_GREEN: 0, LH_ADV_L_BAR_RED: 0 })).lit, false);
});

test("AOA indexer: any of its lights gives the three-part indexer", () => {
	const look = keyLook({ lamp: "AOA_INDEXER_NORMAL", title: "AOA" }, lookup, dcs({ AOA_INDEXER_HIGH: 0, AOA_INDEXER_NORMAL: 1, AOA_INDEXER_LOW: 1 }));
	assert.deepEqual(look.glyph, {
		kind: "aoa",
		high: { on: false, colour: "green" },
		normal: { on: true, colour: "yellow" },
		low: { on: true, colour: "red" },
	});
});

test("switch pictures follow the switch type", () => {
	assert.deepEqual(keyLook({ control: "ENGINE_CRANK_SW" }, lookup, dcs({ ENGINE_CRANK_SW: 2 })).glyph, { kind: "three", position: 2, horizontal: true });
	assert.deepEqual(keyLook({ control: "LEFT_DDI_BRT_SELECT" }, lookup, dcs({ LEFT_DDI_BRT_SELECT: 1 })).glyph, { kind: "three", position: 1, horizontal: false });
	assert.deepEqual(keyLook({ control: "MASTER_CAUTION_RESET_SW" }, lookup, dcs({ MASTER_CAUTION_RESET_SW: 0 })).glyph, { kind: "button", pressed: false });
});

test("flaps and gear indicator keys", () => {
	const flaps = keyLook({ lamp: "FLP_LG_FLAPS_LT", title: "FLAPS" }, lookup, dcs({ FLP_LG_HALF_FLAPS_LT: 1 })).glyph;
	assert.deepEqual(flaps, { kind: "flaps", half: { on: true, colour: "green" }, full: { on: false, colour: "green" }, flaps: { on: false, colour: "yellow" } });
	const gear = keyLook({ lamp: "FLP_LG_NOSE_GEAR_LT", title: "GEAR" }, lookup, dcs({ FLP_LG_NOSE_GEAR_LT: 1, FLP_LG_LEFT_GEAR_LT: 1, LANDING_GEAR_HANDLE_LT: 1 }));
	assert.deepEqual(gear.glyph, {
		kind: "gear",
		nose: { on: true, colour: "green" },
		left: { on: true, colour: "green" },
		right: { on: false, colour: "green" },
		handle: { on: true, colour: "red" },
	});
	assert.equal(gear.colour, "red", "handle light (gear in transit) wins");
	assert.deepEqual(keyLook({ control: "GEAR_LEVER" }, lookup, dcs({ GEAR_LEVER: 1 })).glyph, { kind: "toggle", up: true, knob: "wheel" });
});

test("resting positions stay dark: SAFE, RETRACT, NORM", () => {
	const look = (id: string, v: number) => keyLook({ control: id }, lookup, dcs({ [id]: v }));
	assert.equal(look("APU_CONTROL_SW", 1).lit, true);
	assert.equal(look("GEAR_LEVER", 1).state, "UP");
	assert.equal(look("GEAR_LEVER", 0).state, "DOWN");
});

test("keys go dark with the aircraft name when DCS flies another aircraft", () => {
	const other: Dcs = { connected: false, offline: "NO F/A-18C", read: () => undefined, send: () => {} };
	const look = keyLook({ control: "APU_CONTROL_SW" }, lookup, other);
	assert.equal(look.live, false);
	assert.match(keySvg(look), />NO F\/A-18C</);
});
