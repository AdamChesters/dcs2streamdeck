import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { UpdateStatus } from "../main/updates.ts";
import { compareVersions, installable, newestRelease, RELEASES_PAGE, Updater } from "../main/updates.ts";

test("version order includes Alpha releases", () => {
	assert.equal(compareVersions("0.1.0-alpha.10", "0.1.0-alpha.9"), 1);
	assert.equal(compareVersions("0.1.0", "0.1.0-alpha.9"), 1);
	assert.equal(compareVersions("v0.2.0-alpha.1", "0.1.9"), 1);
	assert.equal(compareVersions("0.1.0-alpha.2", "0.1.0-alpha.2"), 0);
	assert.equal(compareVersions("0.1.0-alpha.2", "0.1.0-beta.1"), -1);
});

const bytes = Buffer.from("fake installer bytes");
const sha = createHash("sha256").update(bytes).digest("hex");
const asset = (version: string, digest = sha) => ({
	name: `dcs2streamdeck-${version}-Setup.exe`,
	state: "uploaded",
	size: bytes.length,
	digest: `sha256:${digest}`,
	browser_download_url: `${RELEASES_PAGE}/download/v${version}/dcs2streamdeck-${version}-Setup.exe`,
});

test("picks the newest non-draft release and its Setup.exe", () => {
	const r = newestRelease([
		{ tag_name: "v0.1.0-alpha.2", assets: [asset("0.1.0-alpha.2")] },
		{ tag_name: "v0.2.0", draft: true, assets: [asset("0.2.0")] },
		{ tag_name: "v0.1.0-alpha.3", assets: [asset("0.1.0-alpha.3")], body: "notes" },
		{ tag_name: "not-a-version" },
	])!;
	assert.equal(r.version, "0.1.0-alpha.3");
	assert.equal(r.notes, "notes");
	assert.ok(installable(r));
	assert.equal(installable(newestRelease([{ tag_name: "v0.1.0-alpha.4", assets: [] }])!), false, "no installer: open the release page");
});

function fakeGitHub(list: unknown, redirectTo = "https://release-assets.githubusercontent.com/abc"): typeof fetch {
	return (async (input: string | URL | Request) => {
		const url = String(input);
		if (url.startsWith("https://api.github.com/")) return Response.json(list);
		if (url.startsWith(`${RELEASES_PAGE}/download/`)) return new Response(null, { status: 302, headers: { location: redirectTo } });
		if (url === redirectTo) return new Response(bytes);
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
}

async function run(list: unknown, redirectTo?: string): Promise<UpdateStatus> {
	const updater = new Updater({
		currentVersion: "0.1.0-alpha.2",
		downloadDir: mkdtempSync(path.join(os.tmpdir(), "d2s-updates-")),
		onStatus: () => {},
		fetch: fakeGitHub(list, redirectTo),
	});
	await updater.check();
	assert.equal(updater.status.state, "available");
	await updater.download();
	return updater.status;
}

test("downloads, verifies and readies the installer", async () => {
	const status = await run([{ tag_name: "v0.1.0-alpha.3", assets: [asset("0.1.0-alpha.3")] }]);
	assert.equal(status.state, "ready", status.message);
	assert.deepEqual(readFileSync(status.installer!), bytes);
	assert.match(status.installer!, /dcs2streamdeck-0\.1\.0-alpha\.3-Setup\.exe$/);
});

test("rejects a checksum mismatch", async () => {
	const status = await run([{ tag_name: "v0.1.0-alpha.3", assets: [asset("0.1.0-alpha.3", "0".repeat(64))] }]);
	assert.equal(status.state, "failed");
	assert.match(status.message, /checksum/);
});

test("rejects a redirect to a host that is not GitHub's", async () => {
	const status = await run([{ tag_name: "v0.1.0-alpha.3", assets: [asset("0.1.0-alpha.3")] }], "https://example.com/evil.exe");
	assert.equal(status.state, "failed");
	assert.match(status.message, /not a GitHub release download/);
});

test("current version shows as current", async () => {
	const updater = new Updater({
		currentVersion: "0.1.0-alpha.3",
		downloadDir: os.tmpdir(),
		onStatus: () => {},
		fetch: fakeGitHub([{ tag_name: "v0.1.0-alpha.3", assets: [asset("0.1.0-alpha.3")] }]),
	});
	await updater.check();
	assert.equal(updater.status.state, "current");
});
