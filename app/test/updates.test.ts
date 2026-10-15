import assert from "node:assert/strict";
import { test } from "node:test";

import { compareVersions, newestRelease, RELEASES_PAGE, Updater, zipName } from "../main/updates.ts";

test("version order includes Alpha releases", () => {
	assert.equal(compareVersions("0.1.0-alpha.10", "0.1.0-alpha.9"), 1);
	assert.equal(compareVersions("0.1.0", "0.1.0-alpha.9"), 1);
	assert.equal(compareVersions("v0.2.0-alpha.1", "0.1.9"), 1);
	assert.equal(compareVersions("0.1.0-alpha.2", "0.1.0-alpha.2"), 0);
	assert.equal(compareVersions("0.1.0-alpha.2", "0.1.0-beta.1"), -1);
});

test("zip names follow the plugin naming", () => {
	assert.equal(zipName("0.3.1"), "dcs2streamdeck-fa18c-0.3.1-win.zip");
});

const zip = (version: string) => ({
	name: zipName(version),
	state: "uploaded",
	browser_download_url: `${RELEASES_PAGE}/download/v${version}/${zipName(version)}`,
});

test("picks the newest non-draft release that has this app's zip", () => {
	const r = newestRelease([
		{ tag_name: "v0.3.1", assets: [zip("0.3.1")] },
		{ tag_name: "v0.4.0", draft: true, assets: [zip("0.4.0")] },
		{ tag_name: "v0.3.2", assets: [zip("0.3.2")], body: "notes" },
		{ tag_name: "v0.3.3", assets: [{ name: "dcs2streamdeck-fa18c-0.3.3.streamDeckPlugin", state: "uploaded" }] },
		{ tag_name: "v0.3.4", assets: [{ ...zip("0.3.4"), name: "dcs2streamdeck-f16c-0.3.4-win.zip" }] },
		{ tag_name: "not-a-version" },
	])!;
	assert.equal(r.version, "0.3.2", "plugin-only and other-aircraft releases are skipped");
	assert.equal(r.notes, "notes");
	assert.equal(r.zipUrl, `${RELEASES_PAGE}/download/v0.3.2/dcs2streamdeck-fa18c-0.3.2-win.zip`);
	assert.equal(newestRelease([{ tag_name: "v0.3.5", assets: [{ ...zip("0.3.5"), browser_download_url: "https://example.com/x.zip" }] }]), undefined, "zip must be a GitHub release download");
});

const github = (list: unknown, status = 200): typeof fetch => (async () => Response.json(list, { status })) as typeof fetch;

async function check(currentVersion: string, fakeFetch: typeof fetch) {
	const updater = new Updater({ currentVersion, onStatus: () => {}, fetch: fakeFetch });
	await updater.check();
	return updater.status;
}

test("newer release is available, same release is current", async () => {
	const list = [{ tag_name: "v0.3.2", assets: [zip("0.3.2")] }];
	assert.equal((await check("0.3.1", github(list))).state, "available");
	assert.equal((await check("0.3.2", github(list))).state, "current");
});

test("a private or missing repo fails with a message", async () => {
	const status = await check("0.3.1", github({ message: "Not Found" }, 404));
	assert.equal(status.state, "failed");
	assert.match(status.message, /no public release/);
});
