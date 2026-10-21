// Full loop over real UDP: fake DCS ⇄ DcsBiosClient, with the controls following the player's seat.
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

test("DCS's own name finds the AH-64D, and a control both seats have follows the player's seat", async () => {
	const jsonDir = mkdtempSync(path.join(os.tmpdir(), "dcsbios-json-"));
	copyFileSync(fixture, path.join(jsonDir, `${AIRCRAFT.module}.json`));
	const ports = { exportPort: 25010, commandPort: 27778 };
	const sim = spawn(
		process.execPath,
		["tools/fake-dcs.ts", "--aircraft", AIRCRAFT.module, "--json", fixture, "--port", "25010", "--command-port", "27778"],
		{ stdio: "ignore" },
	);
	const client = new DcsBiosClient(ports);
	const fleet = new Fleet(client);
	fleet.load(jsonDir);
	try {
		client.start();
		await waitFor(() => client.connected, 5000);
		assert.equal(client.aircraft, "AH-64D_BLK_II");
		assert.equal(fleet.flying()?.AIRCRAFT.id, "ah64d");
		assert.ok(fleet.isFlying("ah64d"));

		const controls = fleet.controls("ah64d");
		const canopy = controls.get("CANOPY")!;
		const pilot = controls.get("PLT_CANOPY")!;
		const gunner = controls.get("CPG_CANOPY")!;
		const dcs = fleet.dcs("ah64d");
		const seen: unknown[] = [];
		client.watch(canopy, (v) => seen.push(v));
		await waitFor(() => dcs.read(canopy) === 0, 1000);

		// Pilot's seat (the default): the key opens the pilot's canopy only.
		dcs.send("CANOPY", "1");
		await waitFor(() => client.read(pilot) === 1, 2000);
		assert.equal(client.read(gunner), 0);
		await waitFor(() => seen.at(-1) === 1, 1000);

		// Front seat: the same key now shows and works the gunner's canopy.
		client.send("SEAT_POSITION", "1");
		await waitFor(() => seen.at(-1) === 0, 2000);
		assert.equal(dcs.read(canopy), 0, "the gunner's canopy is still closed");
		dcs.send("CANOPY", "1");
		await waitFor(() => client.read(gunner) === 1, 2000);
		await waitFor(() => seen.at(-1) === 1, 1000);
		assert.deepEqual(seen, [1, 0, 1]);

		// A control only the pilot has keeps its own identifier.
		dcs.send("PLT_CMWS_ARM", "1");
		await waitFor(() => client.read(controls.get("PLT_CMWS_ARM")!) === 1, 2000);
	} finally {
		client.stop();
		sim.kill();
	}
});
