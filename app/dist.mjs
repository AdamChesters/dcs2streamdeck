// Portable Windows zip for one aircraft, on the Windows build machine only:
// set AIRCRAFT (fa18c or f16c, default fa18c), then `npm run dist`.
// Writes release/dcs2streamdeck-<aircraft>-<version>-win.zip, the same naming as the plugins.
// Shared settings are in package.json "build"; names and IDs come from aircraft/<id>/aircraft.ts.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { Arch, build, Platform } from "electron-builder";

const id = process.env.AIRCRAFT ?? "fa18c";
const { AIRCRAFT } = await import(pathToFileURL(`../aircraft/${id}/aircraft.ts`).href);
const app = JSON.parse(readFileSync("package.json", "utf8"));
const root = JSON.parse(readFileSync("../package.json", "utf8"));
if (app.version !== root.version) throw new Error(`app version ${app.version} differs from plugin version ${root.version}`);

await build({
	targets: Platform.WINDOWS.createTarget("zip", Arch.x64),
	publish: "never",
	config: {
		...app.build,
		appId: AIRCRAFT.uuid,
		productName: `dcs2streamdeck ${AIRCRAFT.name.replace("/", "")}`,
		artifactName: `dcs2streamdeck-${AIRCRAFT.id}-\${version}-win.\${ext}`,
		extraMetadata: { name: `dcs2streamdeck-${AIRCRAFT.id}`, productName: `dcs2streamdeck ${AIRCRAFT.name.replace("/", "")}` },
	},
});
