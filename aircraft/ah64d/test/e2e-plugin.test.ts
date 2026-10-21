// Runs the built plugin (bin/plugin.js) against a fake Stream Deck app and the fake DCS flying the AH-64D.
// Uses the real default DCS-BIOS ports (5010/7778), so DCS-BIOS must not be running on this machine.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import dgram from "node:dgram";
import { copyFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { PRODUCT } from "../../../core/aircraft.data.ts";
import { DEFAULT_OPTIONS } from "../../../core/dcsbios/client.ts";
import { AIRCRAFT } from "../aircraft.ts";

const { WebSocketServer } = createRequire(import.meta.url)("ws");

const root = path.resolve(new URL("../../..", import.meta.url).pathname);
const pluginDir = path.join(root, "dist", `${PRODUCT.uuid}.sdPlugin`);
const fixture = new URL("fixtures/controls.json", import.meta.url).pathname;
const SWITCH = `${PRODUCT.uuid}.switch`;
const MIRROR_PORT = 31798;

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

test("an AH-64D key works the player's own seat", async () => {
	const jsonDir = mkdtempSync(path.join(os.tmpdir(), "dcsbios-json-"));
	copyFileSync(fixture, path.join(jsonDir, `${AIRCRAFT.module}.json`));

	const received: Message[] = [];
	const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
	await new Promise((r) => wss.once("listening", r));
	let socket: any;
	const key = { settings: { aircraft: "ah64d", control: "CANOPY" }, coordinates: { column: 0, row: 0 }, controller: "Keypad", isInMultiAction: false, state: 0 };
	wss.on("connection", (ws: any) => {
		socket = ws;
		ws.on("message", (data: Buffer) => {
			const m = JSON.parse(data.toString()) as Message;
			received.push(m);
			if (m.event === "getSettings") {
				ws.send(JSON.stringify({ event: "didReceiveSettings", action: SWITCH, context: m.context, device: "dev1", payload: key }));
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
	const plugin = spawn(
		process.execPath,
		["bin/plugin.js", "-port", String(port), "-pluginUUID", PRODUCT.uuid, "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)],
		{ cwd: pluginDir, stdio: "ignore", env: { ...process.env, D2S_RELEASES_API: "http://127.0.0.1:9/none" } },
	);
	const sim = spawn(process.execPath, ["tools/fake-dcs.ts", "--aircraft", AIRCRAFT.module, "--json", fixture], { cwd: root, stdio: "ignore" });
	const commands = dgram.createSocket("udp4");
	const toDcs = (line: string) => commands.send(`${line}\n`, DEFAULT_OPTIONS.commandPort, DEFAULT_OPTIONS.commandHost);

	try {
		await waitFor(() => received.find((m) => m.event === "getGlobalSettings"), 5000, "global settings request");
		sd({ event: "willAppear", action: SWITCH, context: "k1", device: "dev1", payload: key });
		const images = () => received.filter((m) => m.event === "setImage" && m.context === "k1").map(svgOf);
		const after = (n: number, text: string, what: string) => waitFor(() => images().slice(n).find((s) => s.includes(`>${text}<`)), 3000, what);

		await after(0, "CLOSE", "pilot's canopy closed");
		sd({ event: "keyDown", action: SWITCH, context: "k1", device: "dev1", payload: key });
		await after(0, "OPEN", "pilot's canopy open after the press");

		let n = images().length;
		toDcs("SEAT_POSITION 1");
		await after(n, "CLOSE", "front seat: the gunner's canopy, still closed");
		n = images().length;
		sd({ event: "keyDown", action: SWITCH, context: "k1", device: "dev1", payload: key });
		await after(n, "OPEN", "gunner's canopy open after the press");

		// The settings panel lists each control once; the seats' own copies stay out.
		sd({ event: "propertyInspectorDidAppear", action: SWITCH, context: "k1", device: "dev1" });
		const data = await waitFor(() => received.find((m) => m.event === "sendToPropertyInspector" && m.payload.catalog)?.payload, 5000, "settings panel data");
		const ids = data.catalog.map((i: { id: string }) => i.id);
		assert.equal(data.aircraft, "ah64d");
		assert.ok(ids.includes("CANOPY") && ids.includes("PLT_CMWS_ARM"));
		assert.ok(!ids.includes("PLT_CANOPY") && !ids.includes("CPG_CANOPY"));
		assert.match(data.status, /DCS connected \(AH-64D\)/);
	} finally {
		commands.close();
		plugin.kill();
		sim.kill();
		wss.close();
	}
});
