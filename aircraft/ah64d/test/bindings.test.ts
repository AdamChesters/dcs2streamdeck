import assert from "node:assert/strict";
import { test } from "node:test";

import type { Dcs } from "../../../core/bindings.ts";
import { keyDown, keyHold, keyLook, keyUp } from "../../../core/bindings.ts";
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

/** A DCS that records what the keys send. */
function recorder(values: Record<string, number> = {}): Dcs & { sent: string[] } {
	const sent: string[] = [];
	return { ...dcs(values), sent, send: (id, argument) => void sent.push(`${id} ${argument}`) };
}

test("the RTS rocker: hold RADIO or ICS while pressed, or push it", () => {
	const live = recorder({ CYCLIC_RTS: 1 });
	const radio = { control: "CYCLIC_RTS", mode: "hold:0" as const };
	assert.equal(keyDown(radio, lookup, live), true);
	keyUp(radio, lookup, live);
	const push = { control: "CYCLIC_RTS", mode: "depress" as const };
	assert.equal(keyDown(push, lookup, live), true);
	keyUp(push, lookup, live);
	assert.deepEqual(live.sent, ["CYCLIC_RTS 0", "CYCLIC_RTS 1", "CYCLIC_RTS_PRESS TOGGLE"], "the push has no hold in DCS-BIOS");
	const auto = recorder({ CYCLIC_RTS: 1 });
	keyDown({ control: "CYCLIC_RTS" }, lookup, auto);
	keyUp({ control: "CYCLIC_RTS" }, lookup, auto);
	assert.deepEqual(auto.sent, ["CYCLIC_RTS 0", "CYCLIC_RTS 1"], "Automatic holds the first end (RADIO, left)");
});

test("a knob key: a short press is a small step, holding turns faster and faster", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let clock = 0;
	const wait = (ms: number) => {
		for (let i = 0; i < ms; i += 10) {
			clock += 10;
			t.mock.timers.tick(10);
		}
	};
	const live = recorder({ COM_MASTER_VOL: 30000 });
	const up = { control: "COM_MASTER_VOL", mode: "inc" as const };
	assert.equal(keyDown(up, lookup, live), true);
	const stop = keyHold(up, lookup, live, () => clock);
	assert.ok(stop);
	wait(280);
	assert.deepEqual(live.sent, ["COM_MASTER_VOL +1311"], "2% for a short press, nothing more yet");
	wait(2000);
	stop();
	const steps = live.sent.slice(1).map((s) => Number(s.split(" +")[1]));
	assert.ok(steps.length > 40, "a step every 40 ms");
	assert.ok(steps.every((n, i) => i === 0 || n >= steps[i - 1]), "never slows down");
	assert.ok(steps[0] < 700 && steps.at(-1) === 3277, "1% at first, 5% after 1.5 s");
	const count = live.sent.length;
	wait(500);
	assert.equal(live.sent.length, count, "stops when the key is let go");
});

test("the collective cursor: a Push key deflects it while held, further the longer, and centres it on release", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let clock = 0;
	const wait = (ms: number) => {
		for (let i = 0; i < ms; i += 10) {
			clock += 10;
			t.mock.timers.tick(10);
		}
	};
	const live = recorder({ COLLECTIVE_CURSOR_UD: 32768 });
	const up = { control: "COLLECTIVE_CURSOR_UD", mode: "push:high" as const };
	assert.equal(keyDown(up, lookup, live), true);
	const stop = keyHold(up, lookup, live, () => clock);
	assert.ok(stop);
	wait(280);
	assert.deepEqual(live.sent, ["COLLECTIVE_CURSOR_UD 39321"], "a gentle 20% push at first");
	wait(1500);
	stop();
	keyUp(up, lookup, live);
	const values = live.sent.map((s) => Number(s.split(" ")[1]));
	assert.ok(values.slice(0, -1).every((v, i) => i === 0 || v >= values[i - 1]), "pushes further, never less");
	assert.equal(values.at(-2), 65535, "full push after 1.5 s");
	assert.equal(live.sent.at(-1), "COLLECTIVE_CURSOR_UD 32768", "centred on release");
	const left = recorder();
	keyDown({ control: "COLLECTIVE_CURSOR_LR", mode: "push:low" }, lookup, left);
	keyUp({ control: "COLLECTIVE_CURSOR_LR", mode: "push:low" }, lookup, left);
	assert.deepEqual(left.sent, ["COLLECTIVE_CURSOR_LR 26214", "COLLECTIVE_CURSOR_LR 32768"]);
});

test("a key that is one bind of a control says which in its default text", () => {
	const title = (control: string, mode?: string) => keyLook({ control, mode: mode as never }, lookup, dcs({})).title;
	assert.equal(title("CYCLIC_RTS", "hold:2"), "PTT/RTS ICS");
	assert.equal(title("CYCLIC_RTS", "depress"), "PTT/RTS Depress");
	assert.equal(title("COLLECTIVE_CURSOR_LR", "push:low"), "Cursor Controller Left");
	assert.equal(title("COM_MASTER_VOL", "dec"), "MASTER Volume Decrease");
	assert.equal(title("CYCLIC_RTS"), "PTT/RTS Switch", "Automatic: just the control");
	assert.equal(keyLook({ control: "CYCLIC_RTS", mode: "hold:2", title: "RTS ICS" }, lookup, dcs({})).title, "RTS ICS", "the user's text wins");
});
