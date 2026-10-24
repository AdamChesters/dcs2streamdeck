import assert from "node:assert/strict";
import { test } from "node:test";

import { catalog } from "../../../core/catalog.ts";
import { defaultKeyMode, formatValue, keyModes, lampColour, loadControls } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const get = (id: string) => controls.get(id)!;

test("a control both seats have is one control, named without the seat", () => {
	const ent = get("KU_ENT");
	assert.equal(ent.category, "Keyboard Unit");
	assert.equal(ent.description, "Keyboard Unit ENTER Key");
	assert.deepEqual(ent.seat?.variants.map((c) => c.identifier), ["PLT_KU_ENT", "CPG_KU_ENT"]);
	assert.equal(ent.seat?.position.identifier, "SEAT_POSITION");
	assert.equal(get("PLT_KU_ENT").seatVariant, true, "the seats' own copies stay for typed identifiers");
	assert.equal(defaultKeyMode(ent), "momentary");
});

test("a control only one seat has keeps its identifier; its panel is named for the seat", () => {
	assert.equal(get("PLT_CMWS_ARM").category, "CMWS (pilot)");
	assert.equal(get("PLT_CMWS_ARM").description, "CMWS Flare Squibs Switch");
	assert.equal(get("CPG_TEDAC_DISP_MODE").category, "TEDAC Display (CP/G)");
	assert.equal(controls.has("CMWS_ARM"), false);
	assert.equal(get("SEAT_POSITION").category, "Seat", "not a seat's control: unchanged");
});

test("the lists show each control once", () => {
	const ids = catalog(controls).map((i) => i.id);
	assert.ok(ids.includes("CANOPY") && ids.includes("MASTER_WARNING_L") && ids.includes("PLT_APU_L"));
	assert.equal(ids.filter((id) => /^(PLT|CPG)_(CANOPY|KU_ENT|MASTER_WARNING_L)$/.test(id)).length, 0);
});

test("light colours from DCS-BIOS's colour field", () => {
	assert.equal(lampColour(get("PLT_APU_L")), "green");
	assert.equal(lampColour({ ...get("PLT_APU_L"), color: "amber" }), "yellow");
	assert.equal(lampColour({ ...get("PLT_APU_L"), color: "purple" }), undefined);
});

test("position names", () => {
	assert.equal(formatValue(get("CANOPY"), 1), "OPEN");
	assert.equal(formatValue(get("PLT_CMWS_ARM"), 0), "SAFE");
});

test("what a key can do: hold a rocker, set what stays, push the RTS rocker", () => {
	const labels = (id: string) => keyModes(get(id)).map((m) => m.label);
	assert.deepEqual(labels("CYCLIC_RTS"), ["Hold RADIO", "Hold ICS", "Depress"]);
	assert.equal(defaultKeyMode(get("CYCLIC_RTS")), "hold:0");
	assert.deepEqual(labels("COLLECTIVE_SEARCHLIGHT"), ["Set ON", "Set Off", "Hold STOW", "Next position (wraps)"], "STOW springs back, ON stays");
	assert.deepEqual(labels("PLT_CMWS_PW"), ["Hold Test", "Set On", "Set Off", "Next position (wraps)"]);
	assert.equal(defaultKeyMode(get("PLT_CMWS_PW")), "cycle", "Next position skips Test");
	const item = catalog(controls).find((i) => i.id === "CYCLIC_RTS")!;
	assert.equal(item.auto, "hold:0");
	assert.deepEqual(item.modes?.map((m) => m.value), ["hold:0", "hold:2", "depress"]);
});
