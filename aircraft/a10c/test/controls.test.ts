import assert from "node:assert/strict";
import { test } from "node:test";

import { aircraftByDcsName, dcsName } from "../../../core/aircraft.data.ts";
import { catalog, suggestLamp } from "../../../core/catalog.ts";
import { defaultKeyMode, formatValue, keyModes, lampColour, leverAt, loadControls, pressArgument, releaseArgument } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const get = (id: string) => controls.get(id)!;
const labels = (id: string) => keyModes(get(id)).map((m) => m.label);

test("one entry flies as the A-10C II and as the first A-10C", () => {
	assert.equal(aircraftByDcsName("A-10C_2")?.AIRCRAFT.id, "a10c");
	assert.equal(aircraftByDcsName("A-10C")?.AIRCRAFT.id, "a10c");
	assert.equal(dcsName(aircraft), "A-10C_2");
});

test("names by value, also where DCS-BIOS's own order goes the other way", () => {
	assert.deepEqual(get("AHCP_MASTER_ARM").positions, ["TRAIN", "SAFE", "ARM"]);
	assert.equal(formatValue(get("GEAR_LEVER"), 1), "DOWN", "described as DOWN - UP");
	assert.equal(formatValue(get("FLAPS_SWITCH"), 0), "UP", "described as DN - MVR - UP");
	assert.equal(formatValue(get("LCP_POSITION"), 2), "FLASH", "DCS-BIOS lists FLASH first");
	assert.equal(formatValue(get("OXY_EMERGENCY"), 2), "EMERGENCY", "DCS-BIOS lists Emergency first");
	assert.equal(formatValue(get("FSCP_AMPL"), 1), "NORM");
	assert.equal(formatValue(get("UHF_SQUELCH"), 0), "ON");
	assert.deepEqual(get("LANDING_LIGHTS").positions, ["TAXI", "OFF", "LAND"], "DCS-BIOS's own names, already by value");
	assert.deepEqual(get("A102_HMCS_PW").positions, ["BAT", "OFF", "ON"]);
});

test("levers drawn the way their names say", () => {
	assert.equal(leverAt(get("GEAR_LEVER"), 1), "down");
	assert.equal(leverAt(get("FLAPS_SWITCH"), 0), "up");
	assert.equal(leverAt(get("AHCP_MASTER_ARM"), 2), "up");
	assert.equal(leverAt(get("UFC_INTEN"), 2), "right");
});

test("what a key can do: one end springs back, the other stays", () => {
	assert.deepEqual(labels("EPP_INVERTER"), ["Set STBY", "Set OFF", "Hold TEST", "Next position (wraps)"]);
	assert.deepEqual(labels("ENGINE_OPER_L"), ["Hold IGN", "Set NORM", "Set MOTOR", "Next position (wraps)"]);
	assert.deepEqual(labels("CANOPY_OPEN"), ["Hold CLOSE", "Set HOLD", "Set OPEN", "Next position (wraps)"]);
	assert.deepEqual(labels("CMSP_MWS"), ["Hold MENU", "Set ON", "Set OFF", "Next position (wraps)"]);
	assert.equal(pressArgument(get("CMSP_MWS"), "hold:2", 1), "2");
	assert.equal(releaseArgument(get("CMSP_MWS"), "hold:2"), "1");
	assert.equal(pressArgument(get("CMSP_MWS"), "cycle", 1), "0", "Next position skips MENU");
});

test("rockers hold both ways; a switch with more positions springs back to where it rests", () => {
	assert.deepEqual(labels("UFC_STEER"), ["Hold Up", "Hold Down"]);
	assert.deepEqual(labels("CDU_PG"), ["Hold Up", "Hold Down"]);
	assert.deepEqual(labels("UFC_INTEN"), ["Hold LEFT", "Hold RIGHT"]);
	assert.deepEqual(labels("SEAT_ADJUST"), ["Hold UP", "Hold DOWN"]);
	assert.deepEqual(labels("ENVCP_AC_OPER"), ["Set MAN", "Set AUTO", "Hold COLD", "Hold HOT", "Next position (wraps)"]);
	assert.equal(releaseArgument(get("ENVCP_AC_OPER"), "hold:3"), "0", "back to MAN");
	assert.deepEqual(labels("EFCP_EMER_TRIM"), ["Hold NOSE DN", "Hold RWD", "Hold NOSE UP", "Hold LWD"]);
	assert.equal(releaseArgument(get("EFCP_EMER_TRIM"), "hold:2"), "0");
});

test("switches the jet holds on, push buttons, static switches", () => {
	assert.deepEqual(labels("ANTI_SKID_SWITCH"), ["Set ON", "Set OFF", "Toggle", "Hold (press 1, release 0)"]);
	assert.equal(pressArgument(get("ANTI_SKID_SWITCH"), defaultKeyMode(get("ANTI_SKID_SWITCH")), 0), "1");
	assert.equal(defaultKeyMode(get("UFC_1")), "momentary");
	assert.deepEqual(labels("AHCP_MASTER_ARM"), ["Set ARM", "Set SAFE", "Set TRAIN", "Next position (wraps)", "Step up", "Step down"]);
	assert.equal(labels("ARC210_MASTER")[1], "Set TR G");
});

test("lights: pairs, colours, the gear and AOA indicators as one entry each", () => {
	assert.equal(suggestLamp(get("GEAR_LEVER"), controls), "HANDLE_GEAR_WARNING");
	assert.equal(suggestLamp(get("FIRE_LENG_PULL"), controls), "L_ENG_FIRE");
	assert.equal(suggestLamp(get("UFC_MASTER_CAUTION"), controls), "MASTER_CAUTION");
	assert.equal(suggestLamp(get("NMSP_HARS_BTN"), controls), "NMSP_HARS_LED");
	assert.equal(lampColour(get("DVADR_EOT_REMOTE")), "yellow");
	const descriptions = catalog(controls).map((i) => i.description);
	assert.ok(descriptions.includes("AOA Indexer (green)"));
	assert.ok(descriptions.includes("Landing Gear (green / red)"));
});
