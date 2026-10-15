import { build } from "esbuild";

await build({
	entryPoints: ["src/plugin.ts"],
	outfile: "com.adamchesters.dcs2streamdeck.sdPlugin/bin/plugin.js",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
	logLevel: "info",
});

// The bundle is an ES module; Stream Deck needs this next to it.
import { writeFileSync } from "node:fs";
writeFileSync("com.adamchesters.dcs2streamdeck.sdPlugin/bin/package.json", '{ "type": "module" }\n');
