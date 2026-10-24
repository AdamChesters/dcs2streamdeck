import assert from "node:assert/strict";
import { test } from "node:test";

import type { Dcs } from "../../../core/bindings.ts";
import { keyDown, keyLook, keyUp, keyWatches } from "../../../core/bindings.ts";
import { loadControls, parseControls } from "../../../core/dcsbios/controls.ts";
import { keySvg } from "../../../core/render.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const lookup = (id: string | undefined) => (id ? controls.get(id) : undefined);
const dcs = (values: Record<string, number>): Dcs => ({
	connected: true,
	read: (c) => values[c.identifier],
	send: () => {},
});

test("with a lamp, the text follows the switch and the highlight follows the lamp", () => {
	const s = { control: "JFS_SW", lamp: "LIGHT_JFS_RUN", title: "JFS" };
	const spooling = keyLook(s, lookup, dcs({ JFS_SW: 2, LIGHT_JFS_RUN: 0 }));
	assert.equal(spooling.state, "START 1");
	assert.equal(spooling.lit, false, "JFS starting, RUN light not yet on");
	assert.equal(keyLook(s, lookup, dcs({ JFS_SW: 2, LIGHT_JFS_RUN: 1 })).lit, true, "JFS RUN: highlighted");
	assert.equal(keyLook(s, lookup, dcs({ JFS_SW: 1, LIGHT_JFS_RUN: 0 })).state, "OFF", "jet released the switch");
	assert.deepEqual(keyWatches(s, lookup).map((c) => c.identifier), ["JFS_SW", "LIGHT_JFS_RUN"], "redraws when either changes");
});

test("without a lamp, text and highlight both follow the switch", () => {
	const look = keyLook({ control: "HDPT_SW_L" }, lookup, dcs({ HDPT_SW_L: 1 }));
	assert.equal(look.state, "ON");
	assert.equal(look.lit, true);
	assert.equal(keyWatches({ control: "HDPT_SW_L" }, lookup).length, 1);
});

test("master caution: press resets, key lights yellow with the caution light", () => {
	const s = { control: "MASTER_CAUTION", lamp: "LIGHT_MASTER_CAUTION" };
	const look = keyLook(s, lookup, dcs({ MASTER_CAUTION: 0, LIGHT_MASTER_CAUTION: 1 }));
	assert.equal(look.lit, true);
	assert.equal(look.colour, "yellow");
	assert.equal(look.state, "ON", "the text shows the caution light, not the released button");
	const sent: string[] = [];
	const live = { ...dcs({ MASTER_CAUTION: 0 }), send: (id: string, arg: string) => void sent.push(`${id} ${arg}`) };
	assert.equal(keyDown(s, lookup, live), true);
	keyUp(s, lookup, live);
	assert.deepEqual(sent, ["MASTER_CAUTION 1", "MASTER_CAUTION 0"], "push and release");
});

test("light-only key: shows the light, press does nothing", () => {
	const s = { lamp: "LIGHT_MASTER_CAUTION" };
	const on = keyLook(s, lookup, dcs({ LIGHT_MASTER_CAUTION: 1 }));
	assert.deepEqual({ lit: on.lit, colour: on.colour, kind: on.glyph?.kind }, { lit: true, colour: "yellow", kind: "lens" });
	assert.equal(keyLook(s, lookup, dcs({ LIGHT_MASTER_CAUTION: 0 })).lit, false);
	const sent: string[] = [];
	assert.equal(keyDown(s, lookup, { ...dcs({}), send: (id) => void sent.push(id) }), true, "no alert");
	assert.deepEqual(sent, []);
});

test("one light listed in two colours shows both on one key, red first", () => {
	const led = (identifier: string, description: string) => ({
		identifier, description, category: "Panel", control_type: "led", inputs: [],
		outputs: [{ type: "integer", address: 2, mask: identifier.endsWith("RED") ? 2 : 1, shift_by: identifier.endsWith("RED") ? 1 : 0, max_value: 1, description: "" }],
	});
	const map = parseControls({ Panel: { X_GREEN: led("X_GREEN", "X BAR (green)"), X_RED: led("X_RED", "X BAR (red)") } }, aircraft);
	const look = (v: Record<string, number>) => keyLook({ lamp: "X_GREEN" }, (id) => (id ? map.get(id) : undefined), dcs(v));
	assert.equal(look({ X_GREEN: 1 }).colour, "green");
	assert.equal(look({ X_GREEN: 1, X_RED: 1 }).colour, "red", "red wins when both are on");
	assert.equal(look({}).lit, false);
});

test("AOA indexer: any of its lights gives the three-part indexer", () => {
	const look = keyLook({ lamp: "LIGHT_AOA_MID", title: "AOA" }, lookup, dcs({ LIGHT_AOA_UP: 0, LIGHT_AOA_MID: 1, LIGHT_AOA_DN: 1 }));
	assert.deepEqual(look.glyph, {
		kind: "aoa",
		high: { on: false, colour: "red" },
		normal: { on: true, colour: "green" },
		low: { on: true, colour: "yellow" },
	});
});

test("gear indicator key and gear handle", () => {
	const gear = keyLook({ lamp: "LIGHT_GEAR_N", title: "GEAR" }, lookup, dcs({ LIGHT_GEAR_N: 1, LIGHT_GEAR_L: 1, LIGHT_GEAR_WARN: 1 }));
	assert.deepEqual(gear.glyph, {
		kind: "gear",
		nose: { on: true, colour: "green" },
		left: { on: true, colour: "green" },
		right: { on: false, colour: "green" },
		handle: { on: true, colour: "red" },
	});
	assert.equal(gear.colour, "red", "warning light (gear in transit) wins");
	assert.deepEqual(keyLook({ control: "GEAR_HANDLE" }, lookup, dcs({ GEAR_HANDLE: 1 })).glyph, { kind: "lever", at: "up", knob: "wheel" });
});

test("switch pictures follow the switch type", () => {
	assert.deepEqual(keyLook({ control: "JFS_SW" }, lookup, dcs({ JFS_SW: 2 })).glyph, { kind: "lever", at: "up" }, "F-16C: START 1 (2) up, the first name in DCS's tooltip (not yet checked in DCS)");
	assert.deepEqual(keyLook({ control: "MASTER_ARM_SW" }, lookup, dcs({ MASTER_ARM_SW: 1 })).glyph, { kind: "lever", at: "middle" });
	assert.deepEqual(keyLook({ control: "MASTER_CAUTION" }, lookup, dcs({ MASTER_CAUTION: 0 })).glyph, { kind: "button", pressed: false });
});

test("resting positions stay dark", () => {
	assert.equal(keyLook({ control: "MASTER_ARM_SW" }, lookup, dcs({ MASTER_ARM_SW: 1 })).lit, false, "OFF");
	assert.equal(keyLook({ control: "MASTER_ARM_SW" }, lookup, dcs({ MASTER_ARM_SW: 0 })).lit, true, "SIMULATE");
	assert.equal(keyLook({ control: "HDPT_SW_L" }, lookup, dcs({ HDPT_SW_L: 0 })).lit, false);
});

test("keys go dark with the aircraft name when DCS flies another aircraft", () => {
	const other: Dcs = { connected: false, offline: "NO F-16C", read: () => undefined, send: () => {} };
	const look = keyLook({ control: "HDPT_SW_L" }, lookup, other);
	assert.equal(look.live, false);
	assert.match(keySvg(look), />NO F-16C</);
});
