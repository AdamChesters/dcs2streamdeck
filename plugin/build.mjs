// Builds the Stream Deck plugin (every aircraft in one) in dist/<uuid>.sdPlugin.
// `--pack` also validates and packs it as dist/dcs2streamdeck-<version>.streamDeckPlugin.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const pack = process.argv.includes("--pack");
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const cli = path.join(root, "node_modules", "@elgato", "cli", "bin", "streamdeck.mjs");
const { AIRCRAFT_LIST, PRODUCT } = await import(pathToFileURL(path.join(root, "core", "aircraft.data.ts")).href);

function streamdeck(...args) {
	const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: "inherit" });
	if (result.status !== 0) throw new Error(`streamdeck ${args[0]} failed`);
}

const out = path.join(root, "dist", `${PRODUCT.uuid}.sdPlugin`);
const tokens = {
	__UUID__: PRODUCT.uuid,
	__AIRCRAFT_NAMES__: AIRCRAFT_LIST.map((a) => a.AIRCRAFT.fullName).join(", "),
	__VERSION__: `${version}.0`,
	__MIRROR_PORT__: String(PRODUCT.mirrorPort),
};

rmSync(out, { recursive: true, force: true });
for (const dir of ["imgs", "mirror", "ui"]) cpSync(path.join(root, "plugin", dir), path.join(out, dir), { recursive: true });
cpSync(path.join(root, "plugin", "manifest.json"), path.join(out, "manifest.json"));
for (const file of ["manifest.json", "mirror/index.html", ...readdirSync(path.join(out, "ui")).map((f) => `ui/${f}`)]) {
	if (!/\.(json|html|js)$/.test(file)) continue;
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
	const file = path.join(root, "dist", `dcs2streamdeck-${version}.streamDeckPlugin`);
	renameSync(path.join(root, "dist", `${PRODUCT.uuid}.streamDeckPlugin`), file);
	console.log(`packed ${path.relative(root, file)}`);
	// Release asset too, for people who want the OpenKneeboard tab without the button.
	const { OPENKNEEBOARD_FILE, openKneeboardPlugin } = await import(pathToFileURL(path.join(root, "core", "openkneeboard.ts")).href);
	writeFileSync(path.join(root, "dist", OPENKNEEBOARD_FILE), openKneeboardPlugin(PRODUCT.mirrorPort));
	console.log(`wrote dist/${OPENKNEEBOARD_FILE}`);
}
