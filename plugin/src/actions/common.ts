import streamDeck from "@elgato/streamdeck";

import { AIRCRAFT_LIST, aircraftOf } from "../../../core/aircraft.data.ts";
import { catalog } from "../../../core/catalog.ts";
import { RELEASES_PAGE } from "../../../core/updates.ts";
import { addToOpenKneeboard, fleet, installUpdate, runtime } from "../runtime.ts";

type ActionSettings = { aircraft?: string; control?: string; lamp?: string; functions?: string };

/** The update row: this version, the update state and the newest version. */
function updateData() {
	const update = runtime.updater?.status;
	return {
		update: update?.state ?? "checking",
		version: update?.current ?? "",
		latest: update?.release?.version ?? "",
		updateMessage: update?.message ?? "",
		progress: update?.progress ?? 0,
		releasesPage: RELEASES_PAGE,
	};
}

/** Sends the open property inspector the update row only (often, while downloading). */
export async function sendInspectorUpdate(): Promise<void> {
	await streamDeck.ui.sendToPropertyInspector({ type: "update", ...updateData() });
}

/**
 * Sends the open property inspector what it shows: the key's aircraft (chosen for a new key),
 * that aircraft's controls and presets, the aircraft list, DCS status and the update row.
 */
export async function sendInspectorData(settings: ActionSettings): Promise<void> {
	const aircraft = aircraftOf(settings, fleet.flying());
	await streamDeck.ui.sendToPropertyInspector({
		type: "data",
		status: fleet.statusText(),
		...updateData(),
		aircraft: aircraft.AIRCRAFT.id,
		aircraftList: AIRCRAFT_LIST.map((a) => ({ id: a.AIRCRAFT.id, name: a.AIRCRAFT.fullName })),
		catalog: catalog(fleet.controls(aircraft.AIRCRAFT.id)),
		presets: aircraft.DIAL_PRESETS,
	});
}

/**
 * Handles messages every property inspector can send: "refresh" carries its current settings;
 * "install" downloads and installs the newer plugin; "openkneeboard" adds the VR page to
 * OpenKneeboard and answers with what happens next.
 */
export async function handleInspectorMessage(payload: unknown, settings: ActionSettings): Promise<void> {
	const message = payload as { type?: string; settings?: ActionSettings };
	if (message.type === "refresh") await sendInspectorData(message.settings ?? settings);
	if (message.type === "install") installUpdate();
	if (message.type === "openkneeboard") {
		const note = await addToOpenKneeboard().catch((e: Error) => `Could not open it: ${e.message}`);
		await streamDeck.ui.sendToPropertyInspector({ type: "openkneeboard", note });
	}
}
