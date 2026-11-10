import assert from "node:assert/strict";
import { test } from "node:test";

import { aircraftByDcsName, dcsName } from "../../../core/aircraft.data.ts";
import { catalog, suggestLamp } from "../../../core/catalog.ts";
import { defaultKeyMode, formatValue, keyModes, lampColour, leverAt, loadControls, pressArgument, releaseArgument } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const get = (id: string) => controls.get(id)!;
const labels = (id: string) => keyModes(get(id)).map((m) => m.label);

test("one entry flies as the Black Shark 3 and as the older Ka-50", () => {
	assert.equal(aircraftByDcsName("Ka-50_3")?.AIRCRAFT.id, "ka50");
	assert.equal(aircraftByDcsName("Ka-50")?.AIRCRAFT.id, "ka50");
	assert.equal(dcsName(aircraft), "Ka-50_3");
});

test("names by value (DCS-BIOS gives the Ka-50 none)", () => {
	assert.deepEqual(get("WEAPONS_MASTER_ARM").positions, ["DISARM", "ARM"]);
	assert.equal(formatValue(get("WEAPONS_CANNON_RATE"), 0), "HI", "the high rate is position 0");
	assert.deepEqual(get("WEAPONS_CANNON_BURST").positions, ["SHORT", "MEDIUM", "LONG"]);
	assert.deepEqual(get("WEAPONS_MODE").positions, ["MOV", "FIX", "MAN", "FAIL", "NAV"]);
	assert.equal(formatValue(get("PVI_MODES"), 3), "OPER");
	assert.equal(formatValue(get("ENG_SELECTOR"), 3), "TURBO GEAR");
	assert.equal(formatValue(get("GEAR_LEVER"), 1), "DOWN");
	assert.equal(leverAt(get("GEAR_LEVER"), 1), "down");
	assert.equal(formatValue(get("LASER_MODE_COVER"), 1), "OPEN");
	assert.equal(get("EJECT_POWER_1").positions, undefined, "sources disagree: left as ON/OFF");
});

test("buttons DCS-BIOS gives as switches are push buttons, each with its own light", () => {
	for (const id of ["PVI_1", "PVI_WAYPOINTS_BTN", "AP_ALT_HOLD_BTN", "SC_MASTER_CAUTION_BTN", "FLARES_RED"]) {
		assert.equal(defaultKeyMode(get(id)), "momentary", id);
		assert.deepEqual(labels(id), ["Press (hold 1, release 0)"], id);
	}
	assert.equal(pressArgument(get("PVI_1"), "momentary", 0), "1");
	assert.equal(releaseArgument(get("PVI_1"), "momentary"), "0");
	assert.equal(suggestLamp(get("PVI_WAYPOINTS_BTN"), controls), "PVI_WAYPOINTS_LED");
	assert.equal(suggestLamp(get("AP_ALT_HOLD_BTN"), controls), "AP_ALT_HOLD_LED");
	assert.equal(suggestLamp(get("SC_MASTER_CAUTION_BTN"), controls), "SC_MASTER_CAUTION_LED");
	assert.equal(defaultKeyMode(get("ABRIS_BTN_1")), "momentary", "flagged by DCS-BIOS itself");
});

test("what a key can do: switches set, the positions DCS lets go of hold", () => {
	assert.deepEqual(labels("ELEC_BATTERY_1"), ["Set ON", "Set OFF", "Toggle", "Hold (press 1, release 0)"]);
	assert.deepEqual(labels("AP_BARO_RALT"), ["Set RALT", "Set MIDDLE", "Set BARO", "Next position (wraps)", "Step up", "Step down"]);
	assert.deepEqual(labels("OP_NAV_LIGHTS"), ["Set OFF", "Set 10%", "Set 30%", "Set 100%", "Hold CODE", "Next position (wraps)"]);
	assert.equal(releaseArgument(get("OP_NAV_LIGHTS"), "hold:4"), "3", "back to 100%");
	assert.deepEqual(labels("CLK_L_LEVER"), ["Hold PUSHED", "Set NORMAL", "Set PULLED", "Next position (wraps)"]);
	assert.deepEqual(labels("FIREEXT_WARN_TEST"), ["Hold GROUP 1", "Hold GROUP 2", "Hold GROUP 3"]);
	assert.equal(releaseArgument(get("FIREEXT_WARN_TEST"), "hold:2"), "0");
});

test("lights: pairs, colours, the three gear-down lamps as one entry", () => {
	assert.equal(suggestLamp(get("WEAPONS_MASTER_ARM"), controls), "ML_MASTER_ARM");
	assert.equal(suggestLamp(get("ELEC_DC_GROUND_POWER"), controls), "ELEC_LAMP_DC_GROUND_POWER");
	assert.equal(lampColour(get("ELEC_LAMP_DC_GROUND_POWER")), "green");
	const items = catalog(controls);
	assert.ok(items.some((i) => i.description === "Landing Gear (green)"));
	assert.ok(items.some((i) => i.id === "GEAR_NOSE_UP"), "the red gear-up lamps stay their own entries");
});
