// The app's engine against the fake DCS over real UDP (own ports, so it can run beside other tests).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { DcsBiosClient } from "../../core/dcsbios/client.ts";
import type { DeckConfig, DeckState } from "../main/engine.ts";
import { Engine } from "../main/engine.ts";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const fixture = path.join(root, "aircraft", "fa18c", "test", "fixtures", "controls.json");

function until(check: () => boolean, ms: number, what: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const timer = setInterval(() => {
			if (check()) {
				clearInterval(timer);
				resolve();
			} else if (Date.now() - start > ms) {
				clearInterval(timer);
				reject(new Error(`timed out: ${what}`));
			}
		}, 20);
	});
}

test("keys and dials follow DCS, including a switch the jet releases", async () => {
	const jsonDir = mkdtempSync(path.join(os.tmpdir(), "d2s-json-"));
	copyFileSync(fixture, path.join(jsonDir, "FA-18C_hornet.json"));
	const sim = spawn(
		process.execPath,
		["tools/fake-dcs.ts", "--json", fixture, "--magnetic", "APU_CONTROL_SW:1", "--port", "26010", "--command-port", "28778"],
		{ cwd: root, stdio: "ignore" },
	);
	let state: DeckState | undefined;
	let saved = 0;
	const config: DeckConfig = { jsonDir, keys: {}, dials: {} };
	const engine = new Engine(config, (s) => (state = s), () => saved++, new DcsBiosClient({ exportPort: 26010, commandPort: 28778 }));
	const key0 = () => state?.keys[0].svg ?? "";
	try {
		engine.start();
		engine.setKey(0, { control: "APU_CONTROL_SW", title: "APU" });
		engine.setDial(0, { functions: "LEFT_DDI_BRT_CTL | L DDI BRT\nLEFT_DDI_CONT_CTL | L DDI CONT" });
		assert.equal(saved, 2);
		await until(() => key0().includes(">OFF<"), 5000, "APU key OFF from DCS");
		assert.equal(state!.keys.length, 8);
		assert.equal(state!.dials.length, 4);

		assert.equal(engine.keyDown(0), true);
		await until(() => key0().includes(">ON<"), 2000, "APU key ON");
		await until(() => key0().includes(">OFF<"), 3000, "APU key OFF after the jet released it");

		// A key for the other jet stays dark, says which jet it is for, and sends nothing.
		engine.setKey(1, { aircraft: "f16c", control: "HDPT_SW_L" });
		await until(() => (state?.keys[1].svg ?? "").includes(">F-16C<"), 2000, "F-16C key dark while flying the F/A-18C");
		assert.equal(state!.status.flying, "fa18c");
		assert.equal(engine.keyDown(1), false, "no F-16C controls loaded: nothing to press");

		engine.dialRotate(0, 2);
		await until(() => state!.dials[0].view.value === "10%", 2000, "dial 10%");
		engine.dialNext(0);
		await until(() => state!.dials[0].view.title === "L DDI CONT 2/2", 2000, "second knob");

		engine.setDevice({ model: "Stream Deck XL", columns: 8, rows: 4, dials: 0 }, "Stream Deck XL");
		await until(() => state!.keys.length === 32 && state!.dials.length === 0, 2000, "XL layout");
		assert.equal(state!.device, "Stream Deck XL");
	} finally {
		engine.stop();
		sim.kill();
	}
});
