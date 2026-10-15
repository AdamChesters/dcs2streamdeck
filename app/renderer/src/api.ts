import type { DialSettings, KeySettings } from "../../../core/bindings.ts";
import type { PickerItem } from "../../../core/catalog.ts";
import type { DeckState, Layout } from "../../main/engine.ts";
import type { UpdateStatus } from "../../main/updates.ts";

export type { DeckState, DialSettings, KeySettings, Layout, PickerItem, UpdateStatus };

export type Info = { version: string; appId: string; releasesPage: string; elgatoRunning: boolean; deckWindowOpen: boolean };

type Api = {
	state(): Promise<DeckState>;
	controls(): Promise<PickerItem[]>;
	info(): Promise<Info>;
	keyDown(index: number): Promise<boolean>;
	keyUp(index: number): Promise<void>;
	dialRotate(index: number, ticks: number): Promise<boolean>;
	dialNext(index: number): Promise<void>;
	setKey(index: number, settings: KeySettings): Promise<void>;
	setDial(index: number, settings: DialSettings): Promise<void>;
	setJsonDir(dir: string): Promise<void>;
	device(layout: Layout | null, name: string): Promise<void>;
	deckWindow(open: boolean): Promise<void>;
	openExternal(url: string): Promise<void>;
	sendFeedback(fields: { name: string; email: string; message: string }): Promise<{ ok: boolean; error?: string }>;
	updateStatus(): Promise<UpdateStatus>;
	updateCheck(): Promise<void>;
	updateDownload(): Promise<void>;
	updateCancel(): Promise<void>;
	updateInstall(): Promise<boolean>;
	onState(listener: (state: DeckState) => void): () => void;
	onUpdateStatus(listener: (status: UpdateStatus) => void): () => void;
	onElgato(listener: (running: boolean) => void): () => void;
};

export const api = (window as unknown as { d2s: Api }).d2s;
