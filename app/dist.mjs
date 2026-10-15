// Windows installer for one aircraft, on the Windows build machine only:
// set AIRCRAFT (fa18c or f16c, default fa18c), then `npm run dist`.
// Shared settings are in package.json "build"; names and IDs come from aircraft/<id>/aircraft.ts.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { Arch, build, Platform } from "electron-builder";

const id = process.env.AIRCRAFT ?? "fa18c";
const { AIRCRAFT } = await import(pathToFileURL(`../aircraft/${id}/aircraft.ts`).href);
const shared = JSON.parse(readFileSync("package.json", "utf8")).build;

await build({
	targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
	publish: "never",
	config: {
		...shared,
		appId: AIRCRAFT.uuid,
		productName: AIRCRAFT.appId,
		artifactName: `${AIRCRAFT.appId}-\${version}-Setup.\${ext}`,
		extraMetadata: { productName: AIRCRAFT.appId },
		nsis: { ...shared.nsis, shortcutName: `dcs2streamdeck ${AIRCRAFT.name.replace("/", "")}` },
	},
});
