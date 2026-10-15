import streamDeck from "@elgato/streamdeck";

import { AIRCRAFT, DIAL_PRESETS } from "../core/aircraft.data.ts";
import { catalog } from "../core/catalog.ts";
import { client, runtime, statusText } from "../runtime.ts";

/** Sends the control list and status to the open property inspector. */
export async function sendInspectorData(): Promise<void> {
	await streamDeck.ui.sendToPropertyInspector({
		type: "data",
		status: statusText(),
		catalog: catalog(runtime.controls),
		presets: DIAL_PRESETS,
		aircraft: AIRCRAFT.name,
	});
}

/** Handles messages every property inspector can send. */
export async function handleInspectorMessage(payload: unknown): Promise<void> {
	const message = payload as { type?: string };
	if (message.type === "refresh") await sendInspectorData();
}

export function isLive(): boolean {
	return client.connected;
}
