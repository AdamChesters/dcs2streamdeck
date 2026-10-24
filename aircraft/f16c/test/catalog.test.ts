import assert from "node:assert/strict";
import { test } from "node:test";

import { catalog, dialLabel, suggestLamp } from "../../../core/catalog.ts";
import { loadControls } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const controls = loadControls(new URL("fixtures/controls.json", import.meta.url).pathname, aircraft);

test("suggests the switch's own light from the F-16C list", () => {
	assert.equal(suggestLamp(controls.get("JFS_SW")!, controls), "LIGHT_JFS_RUN");
	assert.equal(suggestLamp(controls.get("MASTER_CAUTION")!, controls), "LIGHT_MASTER_CAUTION");
	assert.equal(suggestLamp(controls.get("HDPT_SW_L")!, controls), undefined);
	assert.equal(suggestLamp(controls.get("LIGHT_JFS_RUN")!, controls), undefined);
});

test("catalog groups by panel and marks key, dial and lamp use", () => {
	const items = catalog(controls);
	assert.deepEqual([...new Set(items.map((i) => i.category))], [
		"CMDS",
		"ECM",
		"Engine",
		"Gear System",
		"Interior Lights",
		"MMC",
		"Sensor Panel",
		"UFC",
		"UHF",
		"Warning, Caution and IndicatorLights",
	]);
	const by = Object.fromEntries(items.map((i) => [i.id, i]));
	assert.equal(by.JFS_SW.lamp, "LIGHT_JFS_RUN");
	assert.equal(by.LIGHT_JFS_RUN.led, true);
	assert.equal(by.PRI_CONSOLES_BRT_KNB.dial, true);
	assert.equal(by.JFS_SW.dial, true, "3 positions can go on a dial");
	assert.equal(by.HDPT_SW_L.dial, false);
	assert.equal(by.CMDS_CH_AMOUNT.key, false);
});

test("AOA indexer and landing gear are one entry each", () => {
	const descriptions = catalog(controls).map((i) => i.description);
	assert.ok(descriptions.includes("AOA Indexer (red / green / yellow)"));
	assert.ok(descriptions.includes("Landing Gear (green / red)"));
	assert.equal(catalog(controls).filter((i) => i.id === "LIGHT_GEAR_WARN").length, 0, "warning light is part of the gear entry");
});

test("dial labels", () => {
	assert.equal(dialLabel("PRI_CONSOLES_BRT_KNB"), "PRI CONSOLES B");
	assert.equal(dialLabel("COMM1_PWR_KNB"), "COMM1 PWR");
});
