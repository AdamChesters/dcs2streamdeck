import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { UpdateStatus } from "../core/updates.ts";
import { compareVersions, newestRelease, pluginName, RELEASES_PAGE, releaseVersion, Updater, zipName } from "../core/updates.ts";

test("version order includes Alpha releases", () => {
	assert.equal(compareVersions("0.1.0-alpha.10", "0.1.0-alpha.9"), 1);
	assert.equal(compareVersions("0.1.0", "0.1.0-alpha.9"), 1);
	assert.equal(compareVersions("v0.2.0-alpha.1", "0.1.9"), 1);
	assert.equal(compareVersions("0.1.0-alpha.2", "0.1.0-alpha.2"), 0);
	assert.equal(compareVersions("0.1.0-alpha.2", "0.1.0-beta.1"), -1);
});

test("download names: one plugin and one app for all aircraft", () => {
	assert.equal(zipName("0.4.0"), "dcs2streamdeck-0.4.0-win.zip");
	assert.equal(pluginName("0.4.0"), "dcs2streamdeck-0.4.0.streamDeckPlugin");
	assert.equal(releaseVersion("0.4.0.0"), "0.4.0");
});

const zip = (version: string) => ({
	name: zipName(version),
	state: "uploaded",
	browser_download_url: `${RELEASES_PAGE}/download/v${version}/${zipName(version)}`,
});

test("picks the newest non-draft release that has this product's download", () => {
	const r = newestRelease([
		{ tag_name: "v0.3.1", assets: [zip("0.3.1")] },
		{ tag_name: "v0.4.0", draft: true, assets: [zip("0.4.0")] },
		{ tag_name: "v0.3.2", assets: [zip("0.3.2")], body: "notes" },
		{ tag_name: "v0.3.3", assets: [{ name: pluginName("0.3.3"), state: "uploaded" }] },
		{ tag_name: "v0.3.4", assets: [{ ...zip("0.3.4"), name: "dcs2streamdeck-f16c-0.3.4-win.zip" }] },
		{ tag_name: "not-a-version" },
	], zipName)!;
	assert.equal(r.version, "0.3.2", "plugin-only releases and old per-aircraft zips are skipped");
	assert.equal(r.notes, "notes");
	assert.equal(r.fileUrl, `${RELEASES_PAGE}/download/v0.3.2/dcs2streamdeck-0.3.2-win.zip`);
	assert.equal(newestRelease([{ tag_name: "v0.3.5", assets: [{ ...zip("0.3.5"), browser_download_url: "https://example.com/x.zip" }] }], zipName), undefined, "zip must be a GitHub release download");
});

const github = (list: unknown, status = 200): typeof fetch => (async () => Response.json(list, { status })) as typeof fetch;

async function check(currentVersion: string, fakeFetch: typeof fetch) {
	const updater = new Updater({ currentVersion, fileName: zipName, onStatus: () => {}, fetch: fakeFetch });
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

/** A fake GitHub: the releases list plus one download with the given body, size and digest. */
function githubWithDownload(version: string, body: Buffer, override: { size?: number; digest?: string } = {}): typeof fetch {
	const url = `${RELEASES_PAGE}/download/v${version}/${zipName(version)}`;
	const digest = override.digest ?? `sha256:${createHash("sha256").update(body).digest("hex")}`;
	const list = [{ tag_name: `v${version}`, assets: [{ name: zipName(version), state: "uploaded", browser_download_url: url, size: override.size ?? body.length, digest }] }];
	return (async (input: string | URL) => (String(input) === url ? new Response(new Uint8Array(body)) : Response.json(list))) as typeof fetch;
}

async function install(fakeFetch: typeof fetch) {
	const dir = mkdtempSync(path.join(os.tmpdir(), "d2s-update-"));
	const seen: UpdateStatus[] = [];
	const updater = new Updater({ currentVersion: "0.4.2", fileName: zipName, onStatus: (s) => seen.push({ ...s }), fetch: fakeFetch });
	await updater.check();
	let installed = "";
	await updater.install(dir, async (file, release) => {
		installed = readFileSync(file, "utf8");
		return `installing ${release.version}`;
	});
	rmSync(dir, { recursive: true, force: true });
	return { status: updater.status, seen, installed };
}

test("install downloads the release, checks size and SHA-256, then hands it over", async () => {
	const body = Buffer.from("new app ".repeat(1000));
	const { status, seen, installed } = await install(githubWithDownload("0.4.3", body));
	assert.equal(installed, body.toString());
	assert.equal(status.state, "installing");
	assert.equal(status.message, "installing 0.4.3");
	assert.ok(seen.some((s) => s.state === "downloading"), "download progress is reported");
	assert.equal(status.release?.sha256, createHash("sha256").update(body).digest("hex"));
});

test("a download that does not match is not installed", async () => {
	const body = Buffer.from("tampered");
	const wrongHash = await install(githubWithDownload("0.4.3", body, { digest: `sha256:${"0".repeat(64)}` }));
	assert.equal(wrongHash.installed, "");
	assert.equal(wrongHash.status.state, "available", "it can be tried again");
	assert.match(wrongHash.status.message, /SHA-256/);
	const wrongSize = await install(githubWithDownload("0.4.3", body, { size: body.length + 1 }));
	assert.equal(wrongSize.installed, "");
	assert.match(wrongSize.status.message, /expected/);
});

test("downloads come from GitHub, or from the test releases server when one is set", () => {
	const local = [{ tag_name: "v0.4.3", assets: [{ ...zip("0.4.3"), browser_download_url: "http://127.0.0.1:9/download/x.zip" }] }];
	assert.equal(newestRelease(local, zipName), undefined);
	assert.equal(newestRelease(local, zipName, "http://127.0.0.1:9/")?.version, "0.4.3");
});
