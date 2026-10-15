// Builds one Stream Deck plugin per aircraft in dist/<uuid>.sdPlugin from the shared plugin
// files, with that aircraft's data and names. `--pack` also validates and packs each one as
// dist/dcs2streamdeck-<id>-<version>.streamDeckPlugin. Optional aircraft ID: only that one.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const pack = process.argv.includes("--pack");
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const cli = path.join(root, "node_modules", "@elgato", "cli", "bin", "streamdeck.mjs");

function streamdeck(...args) {
	const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: "inherit" });
	if (result.status !== 0) throw new Error(`streamdeck ${args[0]} failed`);
}

for (const id of readdirSync(path.join(root, "aircraft"))) {
	if (only && id !== only) continue;
	const { AIRCRAFT } = await import(pathToFileURL(path.join(root, "aircraft", id, "aircraft.ts")).href);
	const out = path.join(root, "dist", `${AIRCRAFT.uuid}.sdPlugin`);
	const tokens = {
		__UUID__: AIRCRAFT.uuid,
		__NAME__: AIRCRAFT.name,
		__FULL_NAME__: AIRCRAFT.fullName,
		__VERSION__: `${version}.0`,
		__MIRROR_PORT__: String(AIRCRAFT.mirrorPort),
	};

	rmSync(out, { recursive: true, force: true });
	for (const dir of ["imgs", "mirror", "ui"]) cpSync(path.join(root, "plugin", dir), path.join(out, dir), { recursive: true });
	cpSync(path.join(root, "plugin", "manifest.json"), path.join(out, "manifest.json"));
	for (const file of ["manifest.json", "mirror/index.html", ...readdirSync(path.join(out, "ui")).map((f) => `ui/${f}`)]) {
		if (!/\.(json|html)$/.test(file)) continue;
		let text = readFileSync(path.join(out, file), "utf8");
		for (const [token, value] of Object.entries(tokens)) text = text.replaceAll(token, value);
		writeFileSync(path.join(out, file), text);
	}

	await build({
		entryPoints: [path.join(root, "plugin", "src", "plugin.ts")],
		outfile: path.join(out, "bin", "plugin.js"),
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node24",
		conditions: [id],
		banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
		logLevel: "warning",
	});
	// The bundle is an ES module; Stream Deck needs this next to it.
	writeFileSync(path.join(out, "bin", "package.json"), '{ "type": "module" }\n');
	console.log(`built ${path.relative(root, out)}`);

	if (pack) {
		streamdeck("validate", out);
		mkdirSync(path.join(root, "dist"), { recursive: true });
		streamdeck("pack", out, "--output", path.join(root, "dist"), "--force");
		const file = path.join(root, "dist", `dcs2streamdeck-${id}-${version}.streamDeckPlugin`);
		renameSync(path.join(root, "dist", `${AIRCRAFT.uuid}.streamDeckPlugin`), file);
		console.log(`packed ${path.relative(root, file)}`);
	}
}
