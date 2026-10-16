import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultKeyMode, formatValue, lampColour, loadControls, parseControls, pressArgument, rotateArguments } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);
const get = (id: string) => controls.get(id)!;

test("loads every control by identifier", () => {
	assert.equal(controls.size, 22);
	assert.equal(get("APU_CONTROL_SW").category, "Auxiliary Power Unit Panel");
});

test("default key modes", () => {
	assert.equal(defaultKeyMode(get("APU_CONTROL_SW")), "toggle");
	assert.equal(defaultKeyMode(get("ENGINE_CRANK_SW")), "cycle");
	assert.equal(defaultKeyMode(get("IFEI_MODE_BTN")), "momentary");
	assert.equal(defaultKeyMode(get("MASTER_CAUTION_RESET_SW")), "momentary", "named a button, not flagged by DCS-BIOS");
});

test("press arguments", () => {
	assert.equal(pressArgument(get("APU_CONTROL_SW"), "toggle", 0), "TOGGLE");
	assert.equal(pressArgument(get("ENGINE_CRANK_SW"), "cycle", 1), "2");
	assert.equal(pressArgument(get("ENGINE_CRANK_SW"), "cycle", 2), "0");
	assert.equal(pressArgument(get("ENGINE_CRANK_SW"), "toggle", 0), "1", "toggle falls back to cycle");
	assert.equal(pressArgument(get("LEFT_DDI_BRT_SELECT"), "inc", 0), "INC");
	assert.equal(pressArgument(get("ENGINE_CRANK_SW"), "inc", 0), undefined);
});

test("dial arguments", () => {
	assert.deepEqual(rotateArguments(get("LEFT_DDI_BRT_CTL"), 2, 1000), ["+6400"]);
	assert.deepEqual(rotateArguments(get("LEFT_DDI_BRT_CTL"), -1, 1000, 1000), ["-1000"]);
	assert.deepEqual(rotateArguments(get("ENGINE_CRANK_SW"), 5, 1), ["2"]);
	assert.deepEqual(rotateArguments(get("ENGINE_CRANK_SW"), -5, 1), ["0"]);
	assert.deepEqual(rotateArguments(get("APU_CONTROL_SW"), -2, undefined), ["DEC", "DEC"]);
});

test("value text", () => {
	assert.equal(formatValue(get("APU_CONTROL_SW"), 1), "ON");
	assert.equal(formatValue(get("ENGINE_CRANK_SW"), 2), "RIGHT");
	assert.equal(formatValue(get("LEFT_DDI_BRT_CTL"), 32768), "50%");
});

test("cycle through chosen positions only", () => {
	const crank = get("ENGINE_CRANK_SW"); // LEFT 0, OFF 1, RIGHT 2
	assert.equal(pressArgument(crank, "cycle", 1, [1, 2]), "2", "OFF -> RIGHT");
	assert.equal(pressArgument(crank, "cycle", 2, [1, 2]), "1", "RIGHT -> OFF (skips LEFT)");
	assert.equal(pressArgument(crank, "cycle", 0, [1, 2]), "1", "from an unlisted position, go to the first");
	assert.equal(pressArgument(crank, "cycle", 2, []), "0", "empty list = all positions");
});

test("light colours: suffix, 'light green', and Hornet lights DCS-BIOS gives no colour", () => {
	// Read through parseControls, which adds the colours the aircraft data knows.
	const led = (identifier: string, description: string) =>
		parseControls({ x: { [identifier]: { identifier, description, category: "x", control_type: "led", inputs: [], outputs: [] } } }, aircraft).get(identifier)!;
	assert.equal(lampColour(led("X", "L BAR (red)")), "red");
	assert.equal(lampColour(led("X", "MASTER CAUTION (amber)")), "yellow");
	assert.equal(lampColour(led("X", "Emergency Instrument Lightning (light green)")), "green");
	assert.equal(lampColour(led("ARRESTING_HOOK_LT", "Hook Light")), "red");
	assert.equal(lampColour(led("LANDING_GEAR_HANDLE_LT", "Landing Gear Handle Light")), "red");
	assert.equal(lampColour(led("X", "Something")), undefined);
});

test("2-position switches get their real position names", () => {
	const named = (identifier: string, description: string) =>
		parseControls({
			x: {
				[identifier]: {
					identifier, description, category: "x", control_type: "selector",
					inputs: [{ interface: "set_state", max_value: 1, description: "" }],
					outputs: [{ type: "integer", address: 0, mask: 1, shift_by: 0, max_value: 1, description: "" }],
				},
			},
		}, aircraft).get(identifier)!;
	const arm = named("MASTER_ARM_SW", "Master Arm Switch, ARM/SAFE");
	assert.deepEqual(arm.positions, ["SAFE", "ARM"]);
	assert.equal(formatValue(arm, 1), "ARM");
	const lbar = named("LAUNCH_BAR_SW", "Launch Bar Switch");
	assert.equal(formatValue(lbar, 1), "EXTEND");
	assert.equal(formatValue(lbar, 0), "RETRACT");
	assert.equal(formatValue(named("APU_CONTROL_SW", "APU Control Switch, ON/OFF"), 1), "ON");
	assert.equal(named("X_SW", "Something Switch").positions, undefined, "no names: stays ON/OFF");
});

test("the resting name is position 0 whichever way the description lists it", () => {
	const two = (identifier: string, description: string) =>
		parseControls({
			x: {
				[identifier]: {
					identifier, description, category: "x", control_type: "selector",
					inputs: [{ interface: "set_state", max_value: 1, description: "" }],
					outputs: [{ type: "integer", address: 0, mask: 1, shift_by: 0, max_value: 1, description: "" }],
				},
			},
		}, aircraft).get(identifier)!.positions;
	assert.deepEqual(two("A_SW", "BIT Switch, OFF/BIT"), ["OFF", "BIT"]);
	assert.deepEqual(two("B_SW", "Master Arm Switch, ARM/SAFE"), ["SAFE", "ARM"]);
	assert.deepEqual(two("C_SW", "Generator, NORM/OFF"), ["OFF", "NORM"], "OFF rests more than NORM");
	assert.deepEqual(two("D_SW", "LE Flaps Switch, AUTO/LOCK"), ["AUTO", "LOCK"]);
	assert.deepEqual(two("E_SW", "Hook Bypass, FIELD/CARRIER"), ["CARRIER", "FIELD"], "no resting name: first is position 1");
});

test("latching buttons are not push buttons", () => {
	const ctl = (identifier: string, description: string) =>
		parseControls({
			x: {
				[identifier]: {
					identifier, description, category: "x", control_type: "selector",
					inputs: [{ interface: "set_state", max_value: 1, description: "" }],
					outputs: [{ type: "integer", address: 0, mask: 1, shift_by: 0, max_value: 1, description: "" }],
				},
			},
		}, aircraft).get(identifier)!;
	assert.equal(defaultKeyMode(ctl("ECM_1_BTN", "ECM 1 Button")), "cycle", "latching: toggles");
	assert.equal(defaultKeyMode(ctl("X_RESET", "Reset Button - Press to reset")), "momentary");
	assert.equal(defaultKeyMode(ctl("FCS_RESET_BTN", "FCS RESET Button")), "momentary", "listed in the aircraft data");
});
