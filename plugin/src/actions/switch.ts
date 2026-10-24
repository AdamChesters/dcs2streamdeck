/**
 * Key action: sends a cockpit command and shows the switch state that DCS reports.
 */
import type {
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	KeyUpEvent,
	PropertyInspectorDidAppearEvent,
	SendToPluginEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { aircraftOf, PRODUCT } from "../../../core/aircraft.data.ts";
import type { KeySettings } from "../../../core/bindings.ts";
import { keyDown, keyHold, keyLook, keyUp, keyWatches } from "../../../core/bindings.ts";
import { keySvg, svgDataUrl } from "../../../core/render.ts";
import { client, fleet, mirror, onReset } from "../runtime.ts";
import { handleInspectorMessage, sendInspectorData } from "./common.ts";

export type SwitchSettings = KeySettings;

type Instance = { action: KeyAction<SwitchSettings>; settings: SwitchSettings; stop?: () => void; release?: () => void; held?: boolean };

export class DcsSwitch extends SingletonAction<SwitchSettings> {
	override readonly manifestId: string = `${PRODUCT.uuid}.switch`;
	readonly #instances = new Map<string, Instance>();

	constructor() {
		super();
		onReset(() => {
			for (const instance of this.#instances.values()) this.#bind(instance);
		});
	}

	override onWillAppear(ev: WillAppearEvent<SwitchSettings>): void {
		if (!ev.action.isKey()) return;
		const instance: Instance = { action: ev.action, settings: ev.payload.settings };
		this.#instances.set(ev.action.id, instance);
		this.#bind(instance);
	}

	override onWillDisappear(ev: WillDisappearEvent<SwitchSettings>): void {
		const instance = this.#instances.get(ev.action.id);
		instance?.stop?.();
		instance?.release?.();
		// Gone while pressed (page change): let go, so nothing stays held or pushed.
		if (instance?.held) {
			const id = aircraftOf(instance.settings).AIRCRAFT.id;
			keyUp(instance.settings, fleet.lookup(id), fleet.dcs(id));
		}
		this.#instances.delete(ev.action.id);
		mirror.removeTile(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SwitchSettings>): void {
		const instance = this.#instances.get(ev.action.id);
		if (!instance) return;
		instance.settings = ev.payload.settings;
		this.#bind(instance);
	}

	override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<SwitchSettings>): Promise<void> {
		await sendInspectorData(this.#instances.get(ev.action.id)?.settings ?? {});
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, SwitchSettings>): Promise<void> {
		await handleInspectorMessage(ev.payload, this.#instances.get(ev.action.id)?.settings ?? {});
	}

	override onKeyDown(ev: KeyDownEvent<SwitchSettings>): void {
		const id = aircraftOf(ev.payload.settings).AIRCRAFT.id;
		const instance = this.#instances.get(ev.action.id);
		instance?.release?.();
		if (instance) instance.held = true;
		if (!keyDown(ev.payload.settings, fleet.lookup(id), fleet.dcs(id))) {
			void ev.action.showAlert();
			return;
		}
		// Step and turn keys keep going while held.
		if (instance) instance.release = keyHold(ev.payload.settings, fleet.lookup(id), fleet.dcs(id));
	}

	override onKeyUp(ev: KeyUpEvent<SwitchSettings>): void {
		const id = aircraftOf(ev.payload.settings).AIRCRAFT.id;
		const instance = this.#instances.get(ev.action.id);
		instance?.release?.();
		if (instance) Object.assign(instance, { release: undefined, held: false });
		keyUp(ev.payload.settings, fleet.lookup(id), fleet.dcs(id));
	}

	/** Subscribes the key to its DCS values (only while DCS flies the key's aircraft) and draws it. */
	#bind(instance: Instance): void {
		instance.stop?.();
		const id = aircraftOf(instance.settings).AIRCRAFT.id;
		const watched = fleet.isFlying(id) ? keyWatches(instance.settings, fleet.lookup(id)) : [];
		const stops = watched.map((c) => client.watch(c, () => this.#draw(instance)));
		instance.stop = () => stops.forEach((stop) => stop());
		this.#draw(instance);
	}

	#draw(instance: Instance): void {
		const { action, settings } = instance;
		const id = aircraftOf(settings).AIRCRAFT.id;
		const svg = keySvg(keyLook(settings, fleet.lookup(id), fleet.dcs(id)));
		void action.setImage(svgDataUrl(svg));
		const where = action.coordinates;
		if (where) mirror.setTile(action.id, { kind: "key", device: action.device.id, column: where.column, row: where.row, svg });
	}
}
