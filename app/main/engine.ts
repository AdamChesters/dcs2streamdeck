/**
 * The deck's brain in the standalone app: key and dial settings, DCS-BIOS link,
 * and the images for every slot. No Electron imports, so it runs in tests.
 */
import { aircraftOf } from "../../core/aircraft.data.ts";
import { defaultJsonDir, Fleet } from "../../core/aircraft.ts";
import type { DialSettings, KeySettings } from "../../core/bindings.ts";
import type { PickerItem } from "../../core/catalog.ts";
import { catalog } from "../../core/catalog.ts";
import { dialRotate, dialView, keyDown, keyLook, keyUp, keyWatches, parseFunctions } from "../../core/bindings.ts";
import { DcsBiosClient } from "../../core/dcsbios/client.ts";
import type { Control } from "../../core/dcsbios/controls.ts";
import type { DialView } from "../../core/render.ts";
import { dialSvg, keySvg } from "../../core/render.ts";

export type Layout = { model: string; columns: number; rows: number; dials: number };

/** Shown until a real deck connects. */
export const DEFAULT_LAYOUT: Layout = { model: "Stream Deck +", columns: 4, rows: 2, dials: 4 };

export type DeckConfig = {
	jsonDir?: string;
	keys: Record<string, KeySettings>;
	dials: Record<string, DialSettings>;
};

export type DeckState = {
	layout: Layout;
	/** Connected Stream Deck name, or "" when none. */
	device: string;
	keys: { index: number; svg: string; settings: KeySettings }[];
	dials: { index: number; svg: string; view: DialView; settings: DialSettings }[];
	/** dcs: DCS is sending data; aircraft: what DCS flies; flying: its ID when supported, else "". */
	status: { dcs: boolean; aircraft: string; flying: string; controls: number; loaded: string[]; error: string; jsonDir: string };
};

export class Engine {
	readonly client: DcsBiosClient;
	readonly fleet: Fleet;
	config: DeckConfig;
	#layout: Layout = DEFAULT_LAYOUT;
	#device = "";
	#dialIndex = new Map<number, number>();
	#stops: (() => void)[] = [];
	#pending?: NodeJS.Timeout;
	#onChange: (state: DeckState) => void;
	#onConfig: (config: DeckConfig) => void;

	constructor(
		config: DeckConfig,
		onChange: (state: DeckState) => void,
		onConfig: (config: DeckConfig) => void,
		client = new DcsBiosClient(),
	) {
		this.config = config;
		this.#onChange = onChange;
		this.#onConfig = onConfig;
		this.client = client;
		this.fleet = new Fleet(client);
		// DCS starting, stopping or changing aircraft changes which keys are live.
		client.onStatus(() => this.#rebind());
	}

	/** Lookup and DCS for a key's or dial's aircraft (each is live only while DCS flies it). */
	#for(settings: KeySettings | DialSettings) {
		const id = aircraftOf(settings).AIRCRAFT.id;
		return { id, lookup: this.fleet.lookup(id), dcs: this.fleet.dcs(id) };
	}

	start(): void {
		this.#load();
		this.client.start();
		this.#rebind();
	}

	stop(): void {
		this.client.stop();
		clearTimeout(this.#pending);
	}

	jsonDir(): string {
		return this.config.jsonDir?.trim() || defaultJsonDir();
	}

	/** Called when a Stream Deck connects (layout of that model) or disconnects (null). */
	setDevice(layout: Layout | null, name = ""): void {
		this.#layout = layout ?? DEFAULT_LAYOUT;
		this.#device = layout ? name : "";
		this.#emit();
	}

	setKey(index: number, settings: KeySettings): void {
		this.config.keys[index] = settings;
		this.#saveAndRebind();
	}

	setDial(index: number, settings: DialSettings): void {
		this.config.dials[index] = settings;
		this.#dialIndex.set(index, 0);
		this.#saveAndRebind();
	}

	setJsonDir(dir: string): void {
		this.config.jsonDir = dir;
		this.#load();
		this.#saveAndRebind();
	}

	keyDown(index: number): boolean {
		const s = this.config.keys[index] ?? {};
		const { lookup, dcs } = this.#for(s);
		return keyDown(s, lookup, dcs);
	}

	keyUp(index: number): void {
		const s = this.config.keys[index] ?? {};
		const { lookup, dcs } = this.#for(s);
		keyUp(s, lookup, dcs);
	}

	dialRotate(index: number, ticks: number): boolean {
		const s = this.config.dials[index] ?? {};
		const { lookup, dcs } = this.#for(s);
		return dialRotate(parseFunctions(s.functions)[this.#dialIndex.get(index) ?? 0], ticks, lookup, dcs);
	}

	/** Dial press or strip tap: step to the next knob in the list. */
	dialNext(index: number): void {
		const count = parseFunctions(this.config.dials[index]?.functions).length;
		if (count < 2) return;
		this.#dialIndex.set(index, ((this.#dialIndex.get(index) ?? 0) + 1) % count);
		this.#rebind();
	}

	/** One aircraft's controls for the editor's pickers, grouped by panel. */
	controlsList(aircraft: string): PickerItem[] {
		return catalog(this.fleet.controls(aircraft));
	}

	state(): DeckState {
		const { columns, rows, dials } = this.#layout;
		const keys = Array.from({ length: columns * rows }, (_, index) => {
			const settings = this.config.keys[index] ?? {};
			const empty = !settings.control && !settings.lamp;
			const { lookup, dcs } = this.#for(settings);
			return { index, settings, svg: empty ? keySvgEmpty() : keySvg(keyLook(settings, lookup, dcs)) };
		});
		const dialStates = Array.from({ length: dials }, (_, index) => {
			const settings = this.config.dials[index] ?? {};
			const { lookup, dcs } = this.#for(settings);
			const view = dialView(parseFunctions(settings.functions), this.#dialIndex.get(index) ?? 0, lookup, dcs);
			return { index, settings, view, svg: dialSvg(view) };
		});
		return {
			layout: this.#layout,
			device: this.#device,
			keys,
			dials: dialStates,
			status: {
				dcs: this.client.connected,
				aircraft: this.client.aircraft,
				flying: this.fleet.flying()?.AIRCRAFT.id ?? "",
				controls: this.fleet.size,
				loaded: this.fleet.loaded,
				error: this.fleet.error,
				jsonDir: this.jsonDir(),
			},
		};
	}

	#load(): void {
		this.fleet.load(this.jsonDir());
	}

	#saveAndRebind(): void {
		this.#onConfig(this.config);
		this.#rebind();
	}

	/** Watches every control a key or dial shows (only for the aircraft DCS flies), then redraws. */
	#rebind(): void {
		for (const stop of this.#stops) stop();
		this.#stops = [];
		const watched = new Set<Control>();
		for (const settings of Object.values(this.config.keys)) {
			const { id, lookup } = this.#for(settings);
			if (this.fleet.isFlying(id)) for (const c of keyWatches(settings, lookup)) watched.add(c);
		}
		for (const [index, settings] of Object.entries(this.config.dials)) {
			const { id, lookup } = this.#for(settings);
			const fn = parseFunctions(settings.functions)[this.#dialIndex.get(Number(index)) ?? 0];
			const c = this.fleet.isFlying(id) ? lookup(fn?.identifier) : undefined;
			if (c) watched.add(c);
		}
		for (const c of watched) this.#stops.push(this.client.watch(c, () => this.#emit()));
		this.#emit();
	}

	/** Coalesces bursts of DCS changes into one update (at most ~30 a second). */
	#emit(): void {
		this.#pending ??= setTimeout(() => {
			this.#pending = undefined;
			this.#onChange(this.state());
		}, 30);
	}
}

/** An unassigned key: plain dark glass. */
function keySvgEmpty(): string {
	return '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="16" fill="#151515"/></svg>';
}
