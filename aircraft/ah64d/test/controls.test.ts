import assert from "node:assert/strict";
import { test } from "node:test";

import { catalog, pickedId } from "../../../core/catalog.ts";
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
	assert.deepEqual(labels("COLLECTIVE_CURSOR_UD"), ["Push Up", "Push Down"], "a thumb stick: no Turn, it would stay pushed");
	assert.deepEqual(labels("COLLECTIVE_CURSOR_LR"), ["Push Right", "Push Left"]);
	assert.equal(defaultKeyMode(get("COLLECTIVE_CURSOR_UD")), "push:high");
	assert.deepEqual(labels("COM_MASTER_VOL"), ["Turn up", "Turn down"], "other knobs still turn");
	const item = catalog(controls).find((i) => i.id === "CYCLIC_RTS")!;
	assert.equal(item.auto, "hold:0");
	assert.deepEqual(item.modes?.map((m) => m.value), ["hold:0", "hold:2", "depress"]);
});

test("each bind is its own list entry right under its control, named like DCS's key binds", () => {
	const items = catalog(controls);
	const at = items.findIndex((i) => i.id === "CYCLIC_RTS");
	assert.equal(items[at].description, "PTT/RTS Switch", "DCS-BIOS's trailing dash dropped");
	const binds = items.slice(at + 1, at + 4);
	assert.deepEqual(binds.map((i) => [i.id, i.description, i.action?.mode]), [
		["CYCLIC_RTS_RADIO", "PTT/RTS Switch - RADIO", "hold:0"],
		["CYCLIC_RTS_ICS", "PTT/RTS Switch - ICS", "hold:2"],
		["CYCLIC_RTS_PRESS", "PTT/RTS Switch - Depress", undefined],
	], "Depress is DCS-BIOS's own control, listed once");
	assert.ok(binds.slice(0, 2).every((i) => i.key && !i.dial && !i.led && i.action?.control === "CYCLIC_RTS"));
	assert.equal(pickedId(items, "CYCLIC_RTS", "hold:2"), "CYCLIC_RTS_ICS", "a saved key shows as its bind");
	assert.equal(pickedId(items, "CYCLIC_RTS", ""), "CYCLIC_RTS", "Automatic shows as the control");
	assert.deepEqual(items.filter((i) => i.action?.control === "COLLECTIVE_CURSOR_UD").map((i) => i.description), ["Cursor Controller U/D - Up", "Cursor Controller U/D - Down"]);
	assert.equal(items.filter((i) => i.action?.control === "KU_ENT").length, 0, "a push button is one bind: no extra entries");
	assert.equal(new Set(items.map((i) => i.id)).size, items.length, "every entry has its own id");
});
