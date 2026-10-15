import assert from "node:assert/strict";
import { test } from "node:test";

import { catalog, dialLabel, suggestLamp } from "../../../core/catalog.ts";
import { loadControls } from "../../../core/dcsbios/controls.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname);

test("suggests the APU READY light for the APU switch, nothing for others", () => {
	assert.equal(suggestLamp(controls.get("APU_CONTROL_SW")!, controls), "APU_READY_LT");
	assert.equal(suggestLamp(controls.get("ENGINE_CRANK_SW")!, controls), undefined);
	assert.equal(suggestLamp(controls.get("APU_READY_LT")!, controls), undefined);
});

test("catalog groups by panel and marks key, dial and lamp use", () => {
	const items = catalog(controls);
	assert.deepEqual([...new Set(items.map((i) => i.category))], [
		"Angle of Attack Indexer Lights",
		"Auxiliary Power Unit Panel",
		"Flaps, Landing Gear, Stores Indicator Panel",
		"Integrated Fuel/Engine Indicator (IFEI)",
		"Landing Gear Handle and Warning Tone Silence",
		"Left DDI",
		"LH Advisory Panel",
		"Master Caution Light",
	]);
	const by = Object.fromEntries(items.map((i) => [i.id, i]));
	assert.equal(by.APU_CONTROL_SW.lamp, "APU_READY_LT");
	assert.equal(by.APU_READY_LT.led, true);
	assert.equal(by.LEFT_DDI_BRT_CTL.dial, true);
	assert.equal(by.ENGINE_CRANK_SW.dial, true, "3 positions can go on a dial");
	assert.equal(by.APU_CONTROL_SW.dial, false);
	assert.equal(by.IFEI_CLOCK_H.key, false);
});

test("dial labels", () => {
	assert.equal(dialLabel("LEFT_DDI_BRT_CTL"), "LEFT DDI BRT");
	assert.equal(dialLabel("CONSOLES_DIMMER"), "CONSOLES");
});

test("master caution reset gets the caution light", () => {
	assert.equal(suggestLamp(controls.get("MASTER_CAUTION_RESET_SW")!, controls), "MASTER_CAUTION_LT");
});

test("one picker entry per cockpit light, with all its colours", () => {
	const items = catalog(controls);
	const lbar = items.filter((i) => i.category === "LH Advisory Panel");
	assert.equal(lbar.length, 1);
	assert.match(lbar[0].description, /^L BAR \((green \/ red|red \/ green)\)$/);
	const aoa = items.filter((i) => i.category === "Angle of Attack Indexer Lights");
	assert.deepEqual(aoa.map((i) => i.description), ["AOA Indexer (green / yellow / red)"]);
});

test("flaps and gear indicators are one entry each", () => {
	const panel = catalog(controls).filter((i) => i.category === "Flaps, Landing Gear, Stores Indicator Panel");
	assert.deepEqual(panel.map((i) => i.description).sort(), ["Flaps (green / yellow)", "Landing Gear (green / red)"]);
	assert.equal(catalog(controls).filter((i) => i.id === "LANDING_GEAR_HANDLE_LT").length, 0, "handle light is part of the gear entry");
});
