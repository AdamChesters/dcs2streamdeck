// Portable Windows zip (every aircraft in one), on the Windows build machine only: `npm run dist`.
// Writes release/dcs2streamdeck-<version>-win.zip, the same naming as the plugin.
// Shared settings are in package.json "build"; IDs come from core/aircraft.data.ts.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { Arch, build, Platform } from "electron-builder";

const { PRODUCT } = await import(pathToFileURL("../core/aircraft.data.ts").href);
const app = JSON.parse(readFileSync("package.json", "utf8"));
const root = JSON.parse(readFileSync("../package.json", "utf8"));
if (app.version !== root.version) throw new Error(`app version ${app.version} differs from plugin version ${root.version}`);

await build({
	targets: Platform.WINDOWS.createTarget("zip", Arch.x64),
	publish: "never",
	config: {
		...app.build,
		appId: PRODUCT.uuid,
		productName: "dcs2streamdeck",
		artifactName: "dcs2streamdeck-${version}-win.${ext}",
		extraMetadata: { name: "dcs2streamdeck", productName: "dcs2streamdeck" },
	},
});
