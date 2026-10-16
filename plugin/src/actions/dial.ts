/**
 * Dial action: turn to change a cockpit knob, press (or tap the strip) to step
 * to the next knob in the list. The touch strip shows the knob and its DCS value.
 */
import type {
	DialAction,
	DialDownEvent,
	DialRotateEvent,
	DidReceiveSettingsEvent,
	PropertyInspectorDidAppearEvent,
	SendToPluginEvent,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { aircraftOf, PRODUCT } from "../../../core/aircraft.data.ts";
import type { DialFunction, DialSettings } from "../../../core/bindings.ts";
import { dialRotate, dialView, parseFunctions } from "../../../core/bindings.ts";
import { client, fleet, mirror, onReset } from "../runtime.ts";
import { handleInspectorMessage, sendInspectorData } from "./common.ts";

export type { DialSettings };

type Instance = { action: DialAction<DialSettings>; settings: DialSettings; functions: DialFunction[]; index: number; stop?: () => void };

export class DcsDial extends SingletonAction<DialSettings> {
	override readonly manifestId = `${PRODUCT.uuid}.dial`;
	readonly #instances = new Map<string, Instance>();

	constructor() {
		super();
		onReset(() => {
			for (const instance of this.#instances.values()) this.#bind(instance);
		});
	}

	override onWillAppear(ev: WillAppearEvent<DialSettings>): void {
		if (!ev.action.isDial()) return;
		const settings = ev.payload.settings;
		const instance: Instance = { action: ev.action, settings, functions: parseFunctions(settings.functions), index: 0 };
		this.#instances.set(ev.action.id, instance);
		void ev.action.setTriggerDescription({ rotate: "Adjust", push: "Next knob", touch: "Next knob" });
		this.#bind(instance);
	}

	override onWillDisappear(ev: WillDisappearEvent<DialSettings>): void {
		this.#instances.get(ev.action.id)?.stop?.();
		this.#instances.delete(ev.action.id);
		mirror.removeTile(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<DialSettings>): void {
		const instance = this.#instances.get(ev.action.id);
		if (!instance) return;
		instance.settings = ev.payload.settings;
		instance.functions = parseFunctions(ev.payload.settings.functions);
		instance.index = Math.min(instance.index, Math.max(0, instance.functions.length - 1));
		this.#bind(instance);
	}

	override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<DialSettings>): Promise<void> {
		await sendInspectorData(this.#instances.get(ev.action.id)?.settings ?? {});
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, DialSettings>): Promise<void> {
		await handleInspectorMessage(ev.payload, this.#instances.get(ev.action.id)?.settings ?? {});
	}

	override onDialRotate(ev: DialRotateEvent<DialSettings>): void {
		const instance = this.#instances.get(ev.action.id);
		const id = aircraftOf(ev.payload.settings).AIRCRAFT.id;
		if (!dialRotate(instance?.functions[instance.index], ev.payload.ticks, fleet.lookup(id), fleet.dcs(id))) void ev.action.showAlert();
	}

	override onDialDown(ev: DialDownEvent<DialSettings>): void {
		this.#next(ev.action.id);
	}

	override onTouchTap(ev: TouchTapEvent<DialSettings>): void {
		this.#next(ev.action.id);
	}

	#next(id: string): void {
		const instance = this.#instances.get(id);
		if (!instance || instance.functions.length < 2) return;
		instance.index = (instance.index + 1) % instance.functions.length;
		this.#bind(instance);
	}

	#bind(instance: Instance): void {
		instance.stop?.();
		const id = aircraftOf(instance.settings).AIRCRAFT.id;
		const c = fleet.isFlying(id) ? fleet.lookup(id)(instance.functions[instance.index]?.identifier) : undefined;
		instance.stop = c ? client.watch(c, () => this.#draw(instance)) : undefined;
		this.#draw(instance);
	}

	#draw(instance: Instance): void {
		const { action } = instance;
		const id = aircraftOf(instance.settings).AIRCRAFT.id;
		const view = dialView(instance.functions, instance.index, fleet.lookup(id), fleet.dcs(id));
		void action.setFeedback({ title: view.title, value: view.value, indicator: view.percent });
		mirror.setTile(action.id, { kind: "dial", device: action.device.id, column: action.coordinates.column, dial: view });
	}
}
