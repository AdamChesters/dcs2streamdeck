// Runs the built plugin (bin/plugin.js) against a fake Stream Deck app and the fake DCS.
// Uses the real default DCS-BIOS ports (5010/7778), so DCS-BIOS must not be running on this machine.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { PRODUCT } from "../../../core/aircraft.data.ts";
import { pluginName, RELEASES_PAGE } from "../../../core/updates.ts";
import { AIRCRAFT } from "../aircraft.ts";

const { WebSocketServer } = createRequire(import.meta.url)("ws");

const root = path.resolve(new URL("../../..", import.meta.url).pathname);
const pluginDir = path.join(root, "dist", `${PRODUCT.uuid}.sdPlugin`);
const fixture = new URL("fixtures/controls.json", import.meta.url).pathname;
const SWITCH = `${PRODUCT.uuid}.switch`;
const DIAL = `${PRODUCT.uuid}.dial`;
const MIRROR_PORT = 31799;

type Message = { event: string; context?: string; payload?: any };

function waitFor<T>(find: () => T | undefined, ms: number, what: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const timer = setInterval(() => {
			const found = find();
			if (found !== undefined) {
				clearInterval(timer);
				resolve(found);
			} else if (Date.now() - start > ms) {
				clearInterval(timer);
				reject(new Error(`timed out waiting for ${what}`));
			}
		}, 20);
	});
}

const svgOf = (m: Message) => Buffer.from(String(m.payload.image).split(",")[1], "base64").toString();

/** A fake GitHub releases list with one release holding the plugin. */
async function fakeReleases(version: string): Promise<{ url: string; close: () => void }> {
	const list = [{ tag_name: `v${version}`, assets: [{ name: pluginName(version), state: "uploaded", browser_download_url: `${RELEASES_PAGE}/download/v${version}/${pluginName(version)}` }] }];
	const server = http.createServer((_req, res) => res.end(JSON.stringify(list)));
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/releases`, close: () => server.close() };
}

test("plugin drives keys and dials from DCS state and feeds the mirror", async () => {
	const jsonDir = mkdtempSync(path.join(os.tmpdir(), "dcsbios-json-"));
	copyFileSync(fixture, path.join(jsonDir, `${AIRCRAFT.module}.json`));

	const received: Message[] = [];
	const settingsOf: Record<string, object> = {};
	const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
	await new Promise((r) => wss.once("listening", r));
	let socket: any;
	wss.on("connection", (ws: any) => {
		socket = ws;
		ws.on("message", (data: Buffer) => {
			const m = JSON.parse(data.toString()) as Message;
			received.push(m);
			if (m.event === "getSettings") {
				const payload = { settings: settingsOf[m.context!] ?? {}, coordinates: { column: 0, row: 0 }, controller: "Keypad", isInMultiAction: false, state: 0 };
				ws.send(JSON.stringify({ event: "didReceiveSettings", action: SWITCH, context: m.context, device: "dev1", payload }));
			}
			if (m.event === "getGlobalSettings") {
				ws.send(JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: { jsonDir, mirrorPort: MIRROR_PORT } } }));
			}
		});
	});
	const sd = (m: object) => socket.send(JSON.stringify(m));

	const info = {
		application: { font: "Arial", language: "en", platform: "windows", platformVersion: "10", version: "7.1.0" },
		colors: {
			buttonMouseOverBackgroundColor: "#000",
			buttonPressedBackgroundColor: "#000",
			buttonPressedBorderColor: "#000",
			buttonPressedTextColor: "#000",
			highlightColor: "#000",
		},
		devicePixelRatio: 2,
		devices: [{ id: "dev1", name: "Stream Deck +", size: { columns: 4, rows: 2 }, type: 7 }],
		plugin: { uuid: PRODUCT.uuid, version: "0.1.0.0" },
	};
	const port = (wss.address() as { port: number }).port;
	const releases = await fakeReleases("0.2.0");
	const plugin = spawn(
		process.execPath,
		["bin/plugin.js", "-port", String(port), "-pluginUUID", PRODUCT.uuid, "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)],
		{ cwd: pluginDir, stdio: "ignore", env: { ...process.env, D2S_RELEASES_API: releases.url } },
	);
	const sim = spawn(process.execPath, ["tools/fake-dcs.ts", "--json", fixture, "--magnetic", "APU_CONTROL_SW:1"], { cwd: root, stdio: "ignore" });

	try {
		await waitFor(() => received.find((m) => m.event === "registerPlugin"), 5000, "plugin registration");
		await waitFor(() => received.find((m) => m.event === "getGlobalSettings"), 5000, "global settings request");

		// No aircraft setting: a key from before 0.4.0, which is an F/A-18C key.
		const key = { settings: { control: "APU_CONTROL_SW" }, coordinates: { column: 0, row: 0 }, controller: "Keypad", isInMultiAction: false, state: 0 };
		const other = { ...key, settings: { aircraft: "f16c", control: "HDPT_SW_L" }, coordinates: { column: 2, row: 0 } };
		const dial = {
			settings: { functions: "LEFT_DDI_BRT_CTL | L DDI BRT\nLEFT_DDI_CONT_CTL | L DDI CONT" },
			coordinates: { column: 1, row: 0 },
			controller: "Encoder",
			isInMultiAction: false,
		};
		settingsOf.k1 = key.settings;
		sd({ event: "willAppear", action: SWITCH, context: "k1", device: "dev1", payload: key });
		sd({ event: "willAppear", action: DIAL, context: "d1", device: "dev1", payload: dial });
		sd({ event: "willAppear", action: SWITCH, context: "k2", device: "dev1", payload: other });

		const images = () => received.filter((m) => m.event === "setImage" && m.context === "k1").map(svgOf);
		const feedback = () => received.filter((m) => m.event === "setFeedback" && m.context === "d1").map((m) => m.payload);

		await waitFor(() => images().find((s) => s.includes(">OFF<")), 5000, "key showing OFF from DCS");

		sd({ event: "keyDown", action: SWITCH, context: "k1", device: "dev1", payload: key });
		await waitFor(() => images().find((s) => s.includes(">ON<")), 3000, "key showing ON after press");
		const onCount = images().length;
		await waitFor(() => images().slice(onCount).find((s) => s.includes(">OFF<")), 3000, "key showing OFF after the jet released it");

		sd({ event: "dialRotate", action: DIAL, context: "d1", device: "dev1", payload: { ...dial, ticks: 2, pressed: false } });
		await waitFor(() => feedback().find((f) => f.value === "10%" && f.title === "L DDI BRT 1/2"), 3000, "dial showing 10%");

		sd({ event: "dialDown", action: DIAL, context: "d1", device: "dev1", payload: dial });
		await waitFor(() => feedback().find((f) => f.title === "L DDI CONT 2/2"), 3000, "dial on 2nd knob");

		// The other jet's key stays dark and says which jet it is for.
		const otherImages = () => received.filter((m) => m.event === "setImage" && m.context === "k2").map(svgOf);
		await waitFor(() => otherImages().find((s) => s.includes(">F-16C<")), 3000, "other jet's key showing F-16C");

		// The settings panel: the key's aircraft, its controls, and the update row.
		sd({ event: "propertyInspectorDidAppear", action: SWITCH, context: "k1", device: "dev1" });
		const data = await waitFor(
			() => received.find((m) => m.event === "sendToPropertyInspector" && m.payload.update === "available")?.payload,
			5000,
			"settings panel data with update available",
		);
		assert.equal(data.aircraft, "fa18c");
		assert.deepEqual(data.aircraftList.map((a: { id: string }) => a.id), ["fa18c", "f16c"]);
		assert.ok(data.catalog.find((i: { id: string }) => i.id === key.settings.control));
		assert.equal(data.releasesPage, RELEASES_PAGE);
		assert.equal(data.version, "0.1.0");
		assert.equal(data.latest, "0.2.0");

		const res = await fetch(`http://127.0.0.1:${MIRROR_PORT}/events`);
		const reader = res.body!.getReader();
		const snapshot = JSON.parse(new TextDecoder().decode((await reader.read()).value).replace(/^data: /, ""));
		await reader.cancel();
		assert.equal(snapshot.devices[0].hasDials, true);
		assert.ok(snapshot.tiles.find((t: any) => t.kind === "key" && t.column === 0 && t.svg.includes(">OFF<")));
		assert.ok(snapshot.tiles.find((t: any) => t.kind === "dial" && t.column === 1 && t.dial.title === "L DDI CONT 2/2"));
		assert.match(await (await fetch(`http://127.0.0.1:${MIRROR_PORT}/`)).text(), /EventSource/);
	} finally {
		plugin.kill();
		sim.kill();
		wss.close();
		releases.close();
	}
});
