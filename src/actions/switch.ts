/**
 * Key action: sends a cockpit command and shows the switch state that DCS reports.
 */
import type {
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	KeyUpEvent,
	SendToPluginEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import type { KeySettings } from "../core/bindings.ts";
import { keyDown, keyLook, keyUp, keyWatches } from "../core/bindings.ts";
import { keySvg, svgDataUrl } from "../core/render.ts";
import { client, control, dcs, mirror, onReset } from "../runtime.ts";
import { handleInspectorMessage, sendInspectorData } from "./common.ts";

export type SwitchSettings = KeySettings;

type Instance = { action: KeyAction<SwitchSettings>; settings: SwitchSettings; stop?: () => void };

export class DcsSwitch extends SingletonAction<SwitchSettings> {
	override readonly manifestId: string = "com.adamchesters.dcs2streamdeck.switch";
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
		this.#instances.get(ev.action.id)?.stop?.();
		this.#instances.delete(ev.action.id);
		mirror.removeTile(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SwitchSettings>): void {
		const instance = this.#instances.get(ev.action.id);
		if (!instance) return;
		instance.settings = ev.payload.settings;
		this.#bind(instance);
	}

	override async onPropertyInspectorDidAppear(): Promise<void> {
		await sendInspectorData();
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, SwitchSettings>): Promise<void> {
		await handleInspectorMessage(ev.payload);
	}

	override onKeyDown(ev: KeyDownEvent<SwitchSettings>): void {
		if (!keyDown(ev.payload.settings, control, dcs)) void ev.action.showAlert();
	}

	override onKeyUp(ev: KeyUpEvent<SwitchSettings>): void {
		keyUp(ev.payload.settings, control, dcs);
	}

	/** Subscribes the key to its DCS value and draws it. */
	#bind(instance: Instance): void {
		instance.stop?.();
		const stops = keyWatches(instance.settings, control).map((c) => client.watch(c, () => this.#draw(instance)));
		instance.stop = () => stops.forEach((stop) => stop());
		this.#draw(instance);
	}

	#draw(instance: Instance): void {
		const { action, settings } = instance;
		const svg = keySvg(keyLook(settings, control, dcs));
		void action.setImage(svgDataUrl(svg));
		const where = action.coordinates;
		if (where) mirror.setTile(action.id, { kind: "key", device: action.device.id, column: where.column, row: where.row, svg });
	}
}
