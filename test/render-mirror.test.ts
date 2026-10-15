import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { MirrorState, startMirrorServer } from "../src/mirror.ts";
import { keySvg } from "../src/core/render.ts";

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
		assert.deepEqual(await next(), { devices: [], tiles: [] });
		state.setTile("a", { kind: "key", device: "d", column: 1, row: 0, svg: "<svg/>" });
		const update = await next();
		assert.equal(update.tiles[0].column, 1);
		await reader.cancel();
	} finally {
		server.closeAllConnections();
		server.close();
	}
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
	const toggle = keySvg({ title: "APU", state: "ON", lit: false, live: true, glyph: { kind: "toggle", up: true } });
	assert.match(toggle, /y2="58"/, "lever up");
});
