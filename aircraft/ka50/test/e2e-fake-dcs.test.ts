// Full loop over real UDP: fake DCS ⇄ DcsBiosClient, flying under the module's second DCS name.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { Fleet } from "../../../core/aircraft.ts";
import { DcsBiosClient } from "../../../core/dcsbios/client.ts";
import { AIRCRAFT } from "../aircraft.ts";

const fixture = new URL("fixtures/controls.json", import.meta.url).pathname;

function waitFor(check: () => boolean, ms: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const timer = setInterval(() => {
			if (check()) {
				clearInterval(timer);
				resolve();
			} else if (Date.now() - start > ms) {
				clearInterval(timer);
				reject(new Error("timed out"));
			}
		}, 20);
	});
}

test("DCS's other name for the aircraft finds it too, and its keys work", async () => {
	const jsonDir = mkdtempSync(path.join(os.tmpdir(), "dcsbios-json-"));
	copyFileSync(fixture, path.join(jsonDir, `${AIRCRAFT.module}.json`));
	const ports = { exportPort: 25010, commandPort: 27778 };
	const sim = spawn(
		process.execPath,
		["tools/fake-dcs.ts", "--aircraft", AIRCRAFT.module, "--dcs-name", "Ka-50", "--json", fixture, "--port", "25010", "--command-port", "27778"],
		{ stdio: "ignore" },
	);
	const client = new DcsBiosClient(ports);
	const fleet = new Fleet(client);
	fleet.load(jsonDir);
	try {
		client.start();
		await waitFor(() => client.connected, 5000);
		assert.equal(client.aircraft, "Ka-50");
		assert.equal(fleet.flying()?.AIRCRAFT.id, "ka50");
		assert.ok(fleet.isFlying("ka50"));
		assert.equal(fleet.isFlying("fa18c"), false);

		const controls = fleet.controls("ka50");
		const dcs = fleet.dcs("ka50");
		const sw = controls.get("ELEC_BATTERY_1")!;
		await waitFor(() => dcs.read(sw) === 0, 1000);
		dcs.send("ELEC_BATTERY_1", "1");
		await waitFor(() => dcs.read(sw) === 1, 2000);

		const knob = controls.get("HUD_BRIGHTNESS")!;
		dcs.send("HUD_BRIGHTNESS", "+3200");
		await waitFor(() => dcs.read(knob) === 3200, 2000);
	} finally {
		client.stop();
		sim.kill();
	}
});
