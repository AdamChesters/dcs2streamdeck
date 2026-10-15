/**
 * The deck's brain in the standalone app: key and dial settings, DCS-BIOS link,
 * and the images for every slot. No Electron imports, so it runs in tests.
 */
import { defaultJsonDir, isOurAircraft, loadAircraftControls, offlineText } from "../../src/core/aircraft.ts";
import type { Dcs, DialSettings, KeySettings } from "../../src/core/bindings.ts";
import type { PickerItem } from "../../src/core/catalog.ts";
import { catalog } from "../../src/core/catalog.ts";
import { dialRotate, dialView, keyDown, keyLook, keyUp, keyWatches, parseFunctions } from "../../src/core/bindings.ts";
import { DcsBiosClient } from "../../src/core/dcsbios/client.ts";
import type { Control, ControlMap } from "../../src/core/dcsbios/controls.ts";
import type { DialView } from "../../src/core/render.ts";
import { dialSvg, keySvg } from "../../src/core/render.ts";

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
	status: { dcs: boolean; aircraft: string; controls: number; loaded: string[]; error: string; jsonDir: string };
};

export class Engine {
	readonly client: DcsBiosClient;
	config: DeckConfig;
	#layout: Layout = DEFAULT_LAYOUT;
	#device = "";
	#controls: ControlMap = new Map();
	#loaded: string[] = [];
	#error = "";
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
		// Aircraft changes only change whether keys are live; the control list is fixed.
		client.onStatus(() => this.#rebind());
		this.dcs = {
			get connected() {
				return client.connected && isOurAircraft(client.aircraft);
			},
			get offline() {
				return offlineText(client.connected);
			},
			read: (c) => (isOurAircraft(client.aircraft) ? client.read(c) : undefined),
			send: (identifier, argument) => {
				if (isOurAircraft(client.aircraft)) client.send(identifier, argument);
			},
		};
	}

	/** DCS as the keys see it: live only while DCS flies this app's aircraft. */
	readonly dcs: Dcs;

	readonly lookup = (identifier: string | undefined): Control | undefined =>
		identifier ? this.#controls.get(identifier.trim()) : undefined;

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
		return keyDown(this.config.keys[index] ?? {}, this.lookup, this.dcs);
	}

	keyUp(index: number): void {
		keyUp(this.config.keys[index] ?? {}, this.lookup, this.dcs);
	}

	dialRotate(index: number, ticks: number): boolean {
		const functions = parseFunctions(this.config.dials[index]?.functions);
		return dialRotate(functions[this.#dialIndex.get(index) ?? 0], ticks, this.lookup, this.dcs);
	}

	/** Dial press or strip tap: step to the next knob in the list. */
	dialNext(index: number): void {
		const count = parseFunctions(this.config.dials[index]?.functions).length;
		if (count < 2) return;
		this.#dialIndex.set(index, ((this.#dialIndex.get(index) ?? 0) + 1) % count);
		this.#rebind();
	}

	/** The controls for the editor's pickers, grouped by panel. */
	controlsList(): PickerItem[] {
		return catalog(this.#controls);
	}

	state(): DeckState {
		const { columns, rows, dials } = this.#layout;
		const keys = Array.from({ length: columns * rows }, (_, index) => {
			const settings = this.config.keys[index] ?? {};
			const empty = !settings.control;
			return { index, settings, svg: empty ? keySvgEmpty() : keySvg(keyLook(settings, this.lookup, this.dcs)) };
		});
		const dialStates = Array.from({ length: dials }, (_, index) => {
			const settings = this.config.dials[index] ?? {};
			const view = dialView(parseFunctions(settings.functions), this.#dialIndex.get(index) ?? 0, this.lookup, this.dcs);
			return { index, settings, view, svg: dialSvg(view) };
		});
		return {
			layout: this.#layout,
			device: this.#device,
			keys,
			dials: dialStates,
			status: {
				dcs: this.dcs.connected,
				aircraft: this.client.aircraft,
				controls: this.#controls.size,
				loaded: this.#loaded,
				error: this.#error,
				jsonDir: this.jsonDir(),
			},
		};
	}

	#load(): void {
		const result = loadAircraftControls(this.jsonDir());
		this.#error = result.error;
		if (result.error) return;
		this.#controls = result.controls;
		this.#loaded = result.loaded;
	}

	#saveAndRebind(): void {
		this.#onConfig(this.config);
		this.#rebind();
	}

	/** Watches every control a key or dial shows, then redraws. */
	#rebind(): void {
		for (const stop of this.#stops) stop();
		this.#stops = [];
		const watched = new Set<Control>();
		for (const settings of Object.values(this.config.keys)) {
			for (const c of keyWatches(settings, this.lookup)) watched.add(c);
		}
		for (const [index, settings] of Object.entries(this.config.dials)) {
			const fn = parseFunctions(settings.functions)[this.#dialIndex.get(Number(index)) ?? 0];
			const c = this.lookup(fn?.identifier);
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
