// Full loop over real UDP: fake DCS ⇄ DcsBiosClient, including a switch the jet releases by itself.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

import { DcsBiosClient } from "../../../core/dcsbios/client.ts";
import { loadControls } from "../../../core/dcsbios/controls.ts";
import * as aircraft from "../aircraft.ts";

const fixture = new URL("fixtures/controls.json", import.meta.url).pathname;
const controls = loadControls(fixture, aircraft);

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

test("commands reach the fake jet and state changes come back, magnetic drop included", async () => {
	const ports = { exportPort: 25010, commandPort: 27778 };
	const sim = spawn(
		process.execPath,
		["tools/fake-dcs.ts", "--json", fixture, "--magnetic", "APU_CONTROL_SW:1", "--port", "25010", "--command-port", "27778"],
		{ stdio: "ignore" },
	);
	const client = new DcsBiosClient(ports);
	try {
		client.start();
		await waitFor(() => client.connected, 5000);
		assert.equal(client.aircraft, "FA-18C_hornet");

		const apu = controls.get("APU_CONTROL_SW")!;
		const seen: unknown[] = [];
		client.watch(apu, (v) => seen.push(v));
		await waitFor(() => client.read(apu) === 0, 1000);

		client.send("APU_CONTROL_SW", "TOGGLE");
		await waitFor(() => seen.includes(1), 2000);
		await waitFor(() => seen.at(-1) === 0, 3000);
		assert.deepEqual(seen, [1, 0], "key saw ON, then the jet released it to OFF");

		const brt = controls.get("LEFT_DDI_BRT_CTL")!;
		client.send("LEFT_DDI_BRT_CTL", "+3200");
		client.send("LEFT_DDI_BRT_CTL", "+3200");
		await waitFor(() => client.read(brt) === 6400, 2000);
	} finally {
		client.stop();
		sim.kill();
	}
});
