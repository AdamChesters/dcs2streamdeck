import streamDeck from "@elgato/streamdeck";

import { AIRCRAFT_LIST, aircraftOf } from "../../../core/aircraft.data.ts";
import { catalog } from "../../../core/catalog.ts";
import { RELEASES_PAGE } from "../../../core/updates.ts";
import { fleet, runtime } from "../runtime.ts";

type ActionSettings = { aircraft?: string; control?: string; lamp?: string; functions?: string };

/**
 * Sends the open property inspector what it shows: the key's aircraft (chosen for a new key),
 * that aircraft's controls and presets, the aircraft list, DCS status and the update state.
 */
export async function sendInspectorData(settings: ActionSettings): Promise<void> {
	const aircraft = aircraftOf(settings, fleet.flying());
	await streamDeck.ui.sendToPropertyInspector({
		type: "data",
		status: fleet.statusText(),
		update: runtime.updater?.status.state ?? "checking",
		releasesPage: RELEASES_PAGE,
		aircraft: aircraft.AIRCRAFT.id,
		aircraftList: AIRCRAFT_LIST.map((a) => ({ id: a.AIRCRAFT.id, name: a.AIRCRAFT.fullName })),
		catalog: catalog(fleet.controls(aircraft.AIRCRAFT.id)),
		presets: aircraft.DIAL_PRESETS,
	});
}

/** Handles messages every property inspector can send: "refresh" carries its current settings. */
export async function handleInspectorMessage(payload: unknown, settings: ActionSettings): Promise<void> {
	const message = payload as { type?: string; settings?: ActionSettings };
	if (message.type === "refresh") await sendInspectorData(message.settings ?? settings);
}
