import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultKeyMode, formatValue, keyModes, lampColour, loadControls, parseControls, pressArgument, releaseArgument, rotateArguments } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const get = (id: string) => controls.get(id)!;

/** A one-control map built in the test, for rules that need custom descriptions. */
const single = (identifier: string, description: string, control_type = "selector") =>
	parseControls({
		x: {
			[identifier]: {
				identifier, description, category: "x", control_type,
				inputs: control_type === "led" ? [] : [{ interface: "set_state", max_value: 1, description: "" }],
				outputs: [{ type: "integer", address: 0, mask: 1, shift_by: 0, max_value: 1, description: "" }],
			},
		},
	}, aircraft).get(identifier)!;

test("loads every control by identifier", () => {
	assert.equal(controls.size, 21);
	assert.equal(get("JFS_SW").category, "Engine");
});

test("default key modes", () => {
	assert.equal(defaultKeyMode(get("HDPT_SW_L")), "toggle");
	assert.equal(defaultKeyMode(get("JFS_SW")), "hold:2", "spring-loaded both ways: hold START 1");
	assert.equal(defaultKeyMode(get("MASTER_ARM_SW")), "cycle");
	assert.equal(defaultKeyMode(get("MAL_IND_LTS_TEST")), "momentary");
	assert.equal(defaultKeyMode(get("MASTER_CAUTION")), "momentary");
});

test("press arguments", () => {
	assert.equal(pressArgument(get("HDPT_SW_L"), "toggle", 0), "TOGGLE");
	assert.equal(pressArgument(get("MASTER_ARM_SW"), "cycle", 1), "2");
	assert.equal(pressArgument(get("MASTER_ARM_SW"), "cycle", 2), "0");
	assert.equal(pressArgument(get("MASTER_ARM_SW"), "toggle", 0), "1", "toggle falls back to cycle");
	assert.equal(pressArgument(get("MASTER_ARM_SW"), "set:2", 0), "2");
	assert.equal(pressArgument(get("JFS_SW"), "hold:0", 1), "0");
	assert.equal(releaseArgument(get("JFS_SW"), "hold:0"), "1", "springs back to OFF");
	assert.equal(releaseArgument(get("MASTER_ARM_SW"), "set:2"), undefined, "stays");
	assert.equal(pressArgument(get("MASTER_ARM_SW"), "inc", 0), "INC");
	assert.equal(pressArgument(get("JFS_SW"), "inc", 0), undefined);
});

test("dial arguments", () => {
	assert.deepEqual(rotateArguments(get("PRI_CONSOLES_BRT_KNB"), 2, 1000), ["+6400"]);
	assert.deepEqual(rotateArguments(get("PRI_CONSOLES_BRT_KNB"), -1, 1000, 1000), ["-1000"]);
	assert.deepEqual(rotateArguments(get("JFS_SW"), 5, 1), ["2"]);
	assert.deepEqual(rotateArguments(get("JFS_SW"), -5, 1), ["0"]);
	assert.deepEqual(rotateArguments(get("HDPT_SW_L"), -2, undefined), ["DEC", "DEC"]);
});

test("value text", () => {
	assert.equal(formatValue(get("HDPT_SW_L"), 1), "ON");
	assert.equal(formatValue(get("JFS_SW"), 2), "START 1");
	assert.equal(formatValue(get("MASTER_ARM_SW"), 0), "SIMULATE", "DCS-BIOS lists it top first; names go by value");
	assert.equal(formatValue(get("PRI_CONSOLES_BRT_KNB"), 32768), "50%");
	assert.equal(formatValue(get("GEAR_HANDLE"), 1), "UP");
	assert.equal(formatValue(get("GEAR_HANDLE"), 0), "DN");
});

test("cycle through chosen positions only", () => {
	const arm = get("MASTER_ARM_SW"); // SIMULATE = 0, OFF = 1, MASTER ARM = 2
	assert.equal(pressArgument(arm, "cycle", 1, [1, 2]), "2", "OFF -> MASTER ARM");
	assert.equal(pressArgument(arm, "cycle", 2, [1, 2]), "1", "MASTER ARM -> OFF (skips SIMULATE)");
	assert.equal(pressArgument(arm, "cycle", 0, [1, 2]), "1", "from an unlisted position, go to the first");
	assert.equal(pressArgument(arm, "cycle", 2, []), "0", "empty list = all positions");
});

test("what a key can do: hold a rocker's ends, set a switch's positions", () => {
	const labels = (id: string) => keyModes(get(id)).map((m) => m.label);
	assert.deepEqual(labels("JFS_SW"), ["Hold START 1", "Hold START 2"], "no OFF: it springs back there");
	assert.deepEqual(labels("MASTER_ARM_SW"), ["Set MASTER ARM", "Set OFF", "Set SIMULATE", "Next position (wraps)", "Step up", "Step down"]);
	assert.deepEqual(labels("PRI_CONSOLES_BRT_KNB"), ["Turn up", "Turn down"]);
	assert.deepEqual(labels("MASTER_CAUTION"), ["Press (hold 1, release 0)"]);
	assert.deepEqual(labels("ICP_DATA_RTN_SEQ_SW"), ["Hold RTN", "Hold SEQ"], "sideways: RTN left, SEQ right");
	assert.deepEqual(labels("UHF_FUNC_KNB").slice(0, 4), ["Set OFF", "Set MAIN", "Set BOTH", "Set ADF"]);
	assert.deepEqual(labels("ECM_1_BTN").slice(0, 2), ["Set DEPRESSED", "Set RELEASED"]);
});

test("light colours: from the description, and the F-16C light DCS-BIOS gives no colour", () => {
	assert.equal(lampColour(get("LIGHT_MASTER_CAUTION")), "yellow");
	assert.equal(lampColour(get("LIGHT_GEAR_WARN")), "red");
	assert.equal(lampColour(single("X", "Something (light green)", "led")), "green");
	assert.equal(lampColour(single("FLOW_INDICATOR_LIGHT", "Oxygen Flow Indicator", "led")), "white");
	assert.equal(lampColour(single("Y", "Something", "led")), undefined);
});

test("2-position switches get their real position names", () => {
	assert.deepEqual(single("A_SW", "BIT Switch, OFF/BIT").positions, ["OFF", "BIT"]);
	assert.deepEqual(single("B_SW", "Master Arm Switch, ARM/SAFE").positions, ["SAFE", "ARM"]);
	assert.deepEqual(single("C_SW", "LE Flaps Switch, AUTO/LOCK").positions, ["AUTO", "LOCK"]);
	assert.deepEqual(single("D_SW", "Hook Bypass, FIELD/CARRIER").positions, ["CARRIER", "FIELD"], "no resting name: first is position 1");
	assert.deepEqual(single("UHF_SQUELCH_SW", "UHF Squelch Switch").positions, ["OFF", "ON"], "from the F-16C list");
	assert.equal(single("E_SW", "Something Switch").positions, undefined, "no names: stays ON/OFF");
});

test("latching buttons are not push buttons", () => {
	assert.equal(defaultKeyMode(single("ECM_1_BTN", "ECM 1 Button")), "cycle", "latching: toggles");
	assert.equal(defaultKeyMode(single("X_RESET", "Reset Button - Press to reset")), "momentary");
});
