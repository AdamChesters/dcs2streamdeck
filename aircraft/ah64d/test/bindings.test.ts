import assert from "node:assert/strict";
import { test } from "node:test";

import type { Dcs } from "../../../core/bindings.ts";
import { keyLook } from "../../../core/bindings.ts";
import { suggestLamp } from "../../../core/catalog.ts";
import { loadControls } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const lookup = (id: string | undefined) => (id ? controls.get(id) : undefined);
const dcs = (values: Record<string, number>): Dcs => ({
	connected: true,
	read: (c) => values[c.identifier],
	send: () => {},
});
const look = (control: string, value: number) => keyLook({ control }, lookup, dcs({ [control]: value }));

test("switch names and directions as seen from the seat", () => {
	assert.deepEqual([look("CYCLIC_WEAPON_LR", 0).state, look("CYCLIC_WEAPON_LR", 0).glyph], ["R", { kind: "lever", at: "left" }]);
	assert.deepEqual([look("CYCLIC_WEAPON_LR", 2).state, look("CYCLIC_WEAPON_LR", 2).glyph], ["M", { kind: "lever", at: "right" }]);
	assert.deepEqual([look("CPG_PROC_SEL_SW", 0).state, look("CPG_PROC_SEL_SW", 0).glyph], ["SP 1", { kind: "lever", at: "up" }]);
	assert.deepEqual(look("COM_FM1_SQL", 2).glyph, { kind: "lever", at: "up" }, "ENABLE is forward");
	assert.deepEqual([look("CPG_STICK_FOLD", 0).state, look("CPG_STICK_FOLD", 0).glyph], ["DOWN", { kind: "lever", at: "down" }]);
	assert.deepEqual(look("PLT_PARK_BRAKE", 1).glyph, { kind: "lever", at: "down" }, "pulled out towards the pilot");
	assert.deepEqual(look("FIRE_DETECT_TEST", 2).glyph, { kind: "lever", at: "right" });
	assert.equal(look("EMERG_ZERO_SW", 1).state, "ZEROIZE");
});

test("knobs turn the way the cockpit's do", () => {
	assert.deepEqual(look("PLT_MASTER_IGN_SW", 2).glyph, { kind: "rotary", position: 2, count: 3 }, "EXT PWR is clockwise");
	assert.deepEqual(look("MPD_L_MODE", 2).glyph, { kind: "rotary", position: 0, count: 3 }, "DAY is counter-clockwise");
	assert.equal(look("MPD_L_MODE", 1).state, "NT");
	assert.deepEqual(look("CPG_TEDAC_DISP_MODE", 0).glyph, { kind: "rotary", position: 2, count: 3 }, "OFF is clockwise");
	assert.deepEqual(look("FIRE_ENG1_CVR", 1).glyph, { kind: "guard", open: true });
});

test("buttons light from their own cockpit light", () => {
	assert.equal(suggestLamp(controls.get("INTL_MWARN_BTN")!, controls), "MASTER_WARNING_L");
	assert.equal(suggestLamp(controls.get("FIRE_ENG1_BTN")!, controls), "ENG_1_FIRE_L");
	assert.equal(suggestLamp(controls.get("PLT_APU_BTN")!, controls), "PLT_APU_L");
	const s = { control: "INTL_MWARN_BTN", lamp: "MASTER_WARNING_L" };
	const warning = keyLook(s, lookup, dcs({ INTL_MWARN_BTN: 0, MASTER_WARNING_L: 1 }));
	assert.equal(warning.lit, true);
	assert.equal(warning.colour, "yellow");
	assert.equal(warning.state, "ON");
	assert.equal(keyLook({ control: "FIRE_ENG1_BTN", lamp: "ENG_1_FIRE_L" }, lookup, dcs({ ENG_1_FIRE_L: 1 })).colour, "yellow");
	assert.equal(keyLook({ control: "INTL_MCAUTION_BTN", lamp: "MASTER_CAUTION_L" }, lookup, dcs({ MASTER_CAUTION_L: 1 })).colour, "green", "the Apache's caution light is green");
});
