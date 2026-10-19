import path from "node:path";
import { fileURLToPath } from "node:url";

import streamDeck, { DeviceType } from "@elgato/streamdeck";

import { releaseVersion } from "../../core/updates.ts";
import { DcsDial } from "./actions/dial.ts";
import { DcsLight } from "./actions/light.ts";
import { sendInspectorUpdate } from "./actions/common.ts";
import { DcsSwitch } from "./actions/switch.ts";
import { startMirrorServer } from "./mirror.ts";
import type { GlobalSettings } from "./runtime.ts";
import { client, DEFAULT_MIRROR_PORT, fleet, loadAircraft, mirror, reset, runtime, startUpdateChecks } from "./runtime.ts";

streamDeck.actions.registerAction(new DcsSwitch());
streamDeck.actions.registerAction(new DcsDial());
streamDeck.actions.registerAction(new DcsLight());

// DCS starting, stopping or changing aircraft changes which keys are live.
client.onStatus(() => {
	mirror.setBar(fleet.infoBar());
	reset();
});

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	runtime.settings = ev.settings;
	loadAircraft();
	reset();
});

/** Touch strip segments, one per dial. */
const DIALS: Partial<Record<DeviceType, number>> = { [DeviceType.StreamDeckPlus]: 4, [DeviceType.StreamDeckPlusXL]: 6 };

function showDevice(device: { id: string; name: string; type: DeviceType; size: { columns: number; rows: number } }): void {
	mirror.setDevice({
		id: device.id,
		name: device.name,
		columns: device.size.columns,
		rows: device.size.rows,
		dials: DIALS[device.type] ?? 0,
		infoBar: device.type === DeviceType.StreamDeckNeo,
	});
}
streamDeck.devices.onDeviceDidConnect((ev) => showDevice(ev.device));

await streamDeck.connect();
for (const device of streamDeck.devices) showDevice(device);
runtime.settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
loadAircraft();
client.start();

const pluginDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
startMirrorServer(mirror, runtime.settings.mirrorPort || DEFAULT_MIRROR_PORT, path.join(pluginDir, "mirror", "index.html"));
reset();

// The settings panel shows whether a newer plugin is out, and the download as it runs.
startUpdateChecks(releaseVersion(streamDeck.info.plugin.version), async () => {
	if (streamDeck.ui.action) await sendInspectorUpdate();
});
