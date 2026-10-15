import path from "node:path";
import { fileURLToPath } from "node:url";

import streamDeck, { DeviceType } from "@elgato/streamdeck";

import { DcsDial } from "./actions/dial.ts";
import { DcsLight } from "./actions/light.ts";
import { DcsSwitch } from "./actions/switch.ts";
import { startMirrorServer } from "./mirror.ts";
import type { GlobalSettings } from "./runtime.ts";
import { client, DEFAULT_MIRROR_PORT, loadAircraft, mirror, reset, runtime } from "./runtime.ts";

streamDeck.actions.registerAction(new DcsSwitch());
streamDeck.actions.registerAction(new DcsDial());
streamDeck.actions.registerAction(new DcsLight());

// Aircraft changes only change whether keys are live; the control list is fixed.
client.onStatus(() => reset());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	runtime.settings = ev.settings;
	loadAircraft();
	reset();
});

function showDevice(device: { id: string; name: string; type: DeviceType; size: { columns: number; rows: number } }): void {
	const hasDials = device.type === DeviceType.StreamDeckPlus || device.type === DeviceType.StreamDeckPlusXL;
	mirror.setDevice({ id: device.id, name: device.name, columns: device.size.columns, rows: device.size.rows, hasDials });
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
