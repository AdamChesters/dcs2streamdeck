/**
 * Dial action: turn to change a cockpit knob, press (or tap the strip) to step
 * to the next knob in the list. The touch strip shows the knob and its DCS value.
 */
import type {
	DialAction,
	DialDownEvent,
	DialRotateEvent,
	DidReceiveSettingsEvent,
	SendToPluginEvent,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import type { DialFunction, DialSettings } from "../core/bindings.ts";
import { dialRotate, dialView, parseFunctions } from "../core/bindings.ts";
import { client, control, dcs, mirror, onReset } from "../runtime.ts";
import { handleInspectorMessage, sendInspectorData } from "./common.ts";

export type { DialSettings };

type Instance = { action: DialAction<DialSettings>; functions: DialFunction[]; index: number; stop?: () => void };

export class DcsDial extends SingletonAction<DialSettings> {
	override readonly manifestId = "com.adamchesters.dcs2streamdeck.dial";
	readonly #instances = new Map<string, Instance>();

	constructor() {
		super();
		onReset(() => {
			for (const instance of this.#instances.values()) this.#bind(instance);
		});
	}

	override onWillAppear(ev: WillAppearEvent<DialSettings>): void {
		if (!ev.action.isDial()) return;
		const instance: Instance = { action: ev.action, functions: parseFunctions(ev.payload.settings.functions), index: 0 };
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
		instance.functions = parseFunctions(ev.payload.settings.functions);
		instance.index = Math.min(instance.index, Math.max(0, instance.functions.length - 1));
		this.#bind(instance);
	}

	override async onPropertyInspectorDidAppear(): Promise<void> {
		await sendInspectorData();
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, DialSettings>): Promise<void> {
		await handleInspectorMessage(ev.payload);
	}

	override onDialRotate(ev: DialRotateEvent<DialSettings>): void {
		const instance = this.#instances.get(ev.action.id);
		if (!dialRotate(instance?.functions[instance.index], ev.payload.ticks, control, dcs)) void ev.action.showAlert();
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
		const c = control(instance.functions[instance.index]?.identifier);
		instance.stop = c ? client.watch(c, () => this.#draw(instance)) : undefined;
		this.#draw(instance);
	}

	#draw(instance: Instance): void {
		const { action } = instance;
		const view = dialView(instance.functions, instance.index, control, dcs);
		void action.setFeedback({ title: view.title, value: view.value, indicator: view.percent });
		mirror.setTile(action.id, { kind: "dial", device: action.device.id, column: action.coordinates.column, dial: view });
	}
}
