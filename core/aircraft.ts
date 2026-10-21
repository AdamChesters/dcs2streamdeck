/**
 * The control lists of every supported aircraft, and DCS as each aircraft's keys see it.
 * Shared by the Stream Deck plugin and the standalone app.
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AircraftData } from "./aircraft.data.ts";
import { AIRCRAFT_LIST, aircraftByDcsName, aircraftById, aircraftByModule, dcsName } from "./aircraft.data.ts";
import type { Dcs, Lookup } from "./bindings.ts";
import type { DcsBiosClient } from "./dcsbios/client.ts";
import type { ControlMap } from "./dcsbios/controls.ts";
import { loadControls } from "./dcsbios/controls.ts";
import type { InfoBarView } from "./render.ts";

export function defaultJsonDir(): string {
	return path.join(os.homedir(), "Saved Games", "DCS", "Scripts", "DCS-BIOS", "doc", "json");
}

export class Fleet {
	readonly client: DcsBiosClient;
	/** Module names loaded, e.g. ["FA-18C_hornet", "F-16C_50"]. */
	loaded: string[] = [];
	/** Why nothing loaded, or "". */
	error = "";
	#controls = new Map<string, ControlMap>();
	#dcs = new Map<string, Dcs>();
	#lookups = new Map<string, Lookup>();

	constructor(client: DcsBiosClient) {
		this.client = client;
	}

	/** Loads each aircraft's DCS-BIOS control file found in `dir`. Keeps the old lists if none is found. */
	load(dir: string): void {
		const found = AIRCRAFT_LIST.filter((a) => existsSync(path.join(dir, `${a.AIRCRAFT.module}.json`)));
		if (found.length === 0) {
			const names = AIRCRAFT_LIST.map((a) => `${a.AIRCRAFT.module}.json`).join(" or ");
			this.error = `No DCS-BIOS control file (${names}) in ${dir}`;
			return;
		}
		this.error = "";
		this.#controls = new Map(found.map((a) => [a.AIRCRAFT.id, loadControls(path.join(dir, `${a.AIRCRAFT.module}.json`), a)]));
		this.loaded = found.map((a) => a.AIRCRAFT.module);
	}

	controls(id: string): ControlMap {
		return this.#controls.get(aircraftById(id).AIRCRAFT.id) ?? new Map();
	}

	/** Number of controls over all aircraft. */
	get size(): number {
		let n = 0;
		for (const map of this.#controls.values()) n += map.size;
		return n;
	}

	lookup(id: string): Lookup {
		const aircraft = aircraftById(id);
		let lookup = this.#lookups.get(aircraft.AIRCRAFT.id);
		if (!lookup) {
			lookup = (identifier) => (identifier ? this.controls(aircraft.AIRCRAFT.id).get(identifier.trim()) : undefined);
			this.#lookups.set(aircraft.AIRCRAFT.id, lookup);
		}
		return lookup;
	}

	/** The supported aircraft DCS is flying, if any. */
	flying(): AircraftData | undefined {
		return this.client.connected ? aircraftByDcsName(this.client.aircraft) : undefined;
	}

	/** The Neo info bar: the aircraft DCS flies (dimmed when not supported), or NO DCS. */
	infoBar(): InfoBarView {
		if (!this.client.connected) return { text: "NO DCS", live: false };
		const flying = this.flying();
		return flying ? { text: flying.AIRCRAFT.name, live: true } : { text: this.client.aircraft || "NO AIRCRAFT", live: false };
	}

	/** True when DCS is flying this aircraft. Keys of other aircraft stay dark and send nothing. */
	isFlying(id: string): boolean {
		return this.client.aircraft === dcsName(aircraftById(id));
	}

	/** DCS as this aircraft's keys see it: live only while DCS flies it. */
	dcs(id: string): Dcs {
		const aircraft = aircraftById(id);
		let dcs = this.#dcs.get(aircraft.AIRCRAFT.id);
		if (!dcs) {
			const client = this.client;
			const flying = () => this.isFlying(aircraft.AIRCRAFT.id);
			dcs = {
				get connected() {
					return client.connected && flying();
				},
				get offline() {
					return client.connected ? aircraft.AIRCRAFT.name : "NO DCS";
				},
				read: (c) => (flying() ? client.read(c) : undefined),
				// A control both seats have goes to the player's own seat.
				send: (identifier, argument) => {
					if (!flying()) return;
					const c = this.controls(aircraft.AIRCRAFT.id).get(identifier);
					client.send(c?.seat ? client.seatControl(c).identifier : identifier, argument);
				},
			};
			this.#dcs.set(aircraft.AIRCRAFT.id, dcs);
		}
		return dcs;
	}

	/** One line for the settings: DCS state and what loaded. */
	statusText(): string {
		const client = this.client;
		const flying = this.flying();
		const state = !client.connected
			? "DCS not sending data"
			: flying
				? `DCS connected (${flying.AIRCRAFT.name})`
				: `DCS is flying ${client.aircraft || "no aircraft"}, which is not supported yet`;
		const names = this.loaded.map((m) => aircraftByModule(m)?.AIRCRAFT.name ?? m).join(", ");
		return `${state}. ${this.error || `${this.size} controls (${names})`}.`;
	}
}
