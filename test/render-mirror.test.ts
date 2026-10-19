import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { crc32 } from "node:zlib";

import { MirrorState, startMirrorServer } from "../core/mirror.ts";
import { openKneeboardPlugin } from "../core/openkneeboard.ts";
import { infoBarSvg, keySvg } from "../core/render.ts";

test("key image shows state, escapes text and marks DCS offline", () => {
	const svg = keySvg({ title: "A<B & C", state: "ON", lit: true, live: true });
	assert.match(svg, /A&lt;B &amp; C/);
	assert.match(svg, />ON</);
	assert.match(keySvg({ title: "APU", state: "ON", lit: true, live: false }), />NO DCS</);
});

test("mirror server sends snapshots and live updates", async () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "mirror-"));
	writeFileSync(path.join(dir, "index.html"), "<p>page</p>");
	const state = new MirrorState();
	const server = startMirrorServer(state, 0, path.join(dir, "index.html"));
	await new Promise((r) => server.once("listening", r));
	const { port } = server.address() as { port: number };
	try {
		assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "<p>page</p>");

		const res = await fetch(`http://127.0.0.1:${port}/events`);
		const reader = res.body!.getReader();
		const next = async () => JSON.parse(new TextDecoder().decode((await reader.read()).value).replace(/^data: /, ""));
		assert.deepEqual(await next(), { devices: [], tiles: [], bar: { text: "NO DCS", live: false } });
		state.setTile("a", { kind: "key", device: "d", column: 1, row: 0, svg: "<svg/>" });
		const update = await next();
		assert.equal(update.tiles[0].column, 1);
		state.setBar({ text: "NO DCS", live: false });
		state.setBar({ text: "F/A-18C", live: true });
		assert.deepEqual((await next()).bar, { text: "F/A-18C", live: true });
		await reader.cancel();
	} finally {
		server.closeAllConnections();
		server.close();
	}
});

test("the app replaces the whole mirror at once", () => {
	const state = new MirrorState();
	let changes = 0;
	state.onChange(() => changes++);
	state.setTile("old", { kind: "key", device: "d", column: 3, row: 1, svg: "<svg/>" });
	const device = { id: "app", name: "Stream Deck +", columns: 4, rows: 2, dials: 4, infoBar: false };
	state.replace({ devices: [device], tiles: [{ kind: "key", device: "app", column: 0, row: 0, svg: "<svg/>" }], bar: { text: "F/A-18C", live: true } });
	assert.equal(changes, 2);
	assert.deepEqual(state.snapshot().devices, [device]);
	assert.deepEqual(state.snapshot().tiles.map((t) => t.column), [0]);
	assert.deepEqual(state.snapshot().bar, { text: "F/A-18C", live: true });
});

test("plugin and app share the mirror port: the second takes it when the first closes", async () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "mirror-"));
	writeFileSync(path.join(dir, "index.html"), "<p>page</p>");
	const first = startMirrorServer(new MirrorState(), 0, path.join(dir, "index.html"));
	await new Promise((r) => first.once("listening", r));
	const { port } = first.address() as AddressInfo;
	const second = startMirrorServer(new MirrorState(), port, path.join(dir, "index.html"), 50);
	try {
		await new Promise((r) => setTimeout(r, 200));
		assert.equal(second.listening, false);
		await new Promise((r) => first.close(r));
		await new Promise((r) => second.once("listening", r));
		assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
	} finally {
		first.close();
		second.close();
	}
});

/** The one file in a zip: its name, data and the CRC its header gives. */
function unzipOne(file: Buffer) {
	assert.equal(file.readUInt32LE(0), 0x04034b50, "zip");
	const nameLength = file.readUInt16LE(26);
	const start = 30 + nameLength;
	return { name: file.toString("utf8", 30, start), data: file.subarray(start, start + file.readUInt32LE(18)), crc: file.readUInt32LE(14) };
}

test("OpenKneeboard plugin file: a zip with v1.json for a tab showing the mirror page", () => {
	const file = openKneeboardPlugin(31730);
	const { name, data, crc } = unzipOne(file);
	assert.equal(name, "v1.json");
	assert.equal(crc, crc32(data));
	const end = file.subarray(file.length - 22);
	assert.equal(end.readUInt32LE(0), 0x06054b50);
	assert.equal(file.readUInt32LE(end.readUInt32LE(16)), 0x02014b50, "central directory where the end record says");

	const manifest = JSON.parse(data.toString());
	assert.equal(manifest.ID, "github.com/AdamChesters/dcs2streamdeck");
	assert.equal(manifest.Metadata.PluginSemanticVersion, "1.0.0");
	assert.equal(manifest.Metadata.OKBMinimumVersion, "1.9");
	const [tab] = manifest.TabTypes;
	assert.ok(tab.ID.startsWith(`${manifest.ID};`));
	assert.equal(tab.Implementation, "WebBrowser");
	assert.equal(tab.ImplementationArgs.URI, "http://127.0.0.1:31730/");

	const other = JSON.parse(unzipOne(openKneeboardPlugin(31731)).data.toString());
	assert.equal(other.Metadata.PluginSemanticVersion, "1.0.0+port.31731", "another port is another version");
	assert.equal(other.TabTypes[0].ImplementationArgs.URI, "http://127.0.0.1:31731/");
});

test("Neo info bar shows DCS and the time, dimmed when nothing supported flies", () => {
	const live = infoBarSvg({ text: "F/A-18C", live: true }, "14:05");
	assert.match(live, /width="248" height="58"/);
	assert.match(live, />F\/A-18C</);
	assert.match(live, />14:05</);
	assert.match(infoBarSvg({ text: "NO DCS", live: false }, "14:05"), /fill="#777">NO DCS</);
});

test("lit keys take the light's colour", () => {
	assert.match(keySvg({ title: "MASTER CAUTION", state: "ON", lit: true, live: true, colour: "yellow" }), /fill="#c99a06"/);
	assert.match(keySvg({ title: "L BAR", state: "ON", lit: true, live: true, colour: "red" }), /fill="#a3241f"/);
	assert.match(keySvg({ title: "APU", state: "ON", lit: true, live: true }), /fill="#1f7a2e"/, "default green");
});

test("light-only keys draw lit lenses; switch keys draw their lever", () => {
	const lens = keySvg({ title: "L BAR", state: "ON", lit: true, live: true, colour: "red", glyph: { kind: "lens", legend: "L BAR", lights: [{ on: false, colour: "green" }, { on: true, colour: "red" }] } });
	assert.match(lens, /fill="#ff3b30"/, "red lens");
	assert.match(lens, />L BAR</);
	const aoa = keySvg({ title: "AOA", state: "ON", lit: true, live: true, glyph: { kind: "aoa", high: { on: true, colour: "green" }, normal: { on: false, colour: "yellow" }, low: { on: false, colour: "red" } } });
	assert.match(aoa, /stroke="#3ddc62"/, "green high chevron");
	assert.equal((aoa.match(/<polyline/g) ?? []).length, 2);
	const toggle = keySvg({ title: "APU", state: "ON", lit: false, live: true, glyph: { kind: "lever", at: "up" } });
	assert.match(toggle, /y2="58"/, "lever up");
});
