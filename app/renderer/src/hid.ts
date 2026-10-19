/**
 * Drives a real Stream Deck over WebHID: draws keys and the touch strip, and
 * sends key, dial and strip input to the main process.
 */
import type { StreamDeckWeb } from "@elgato-stream-deck/webhid";
import { DeviceModelId, getStreamDecks, requestStreamDecks } from "@elgato-stream-deck/webhid";

import type { DeckState, Layout } from "./api.ts";
import { api } from "./api.ts";

type Button = { type: "button"; index: number; row: number; column: number; feedbackType: string; pixelSize?: { width: number; height: number } };
type Lcd = { type: "lcd-segment"; id: number; columnSpan: number; pixelSize: { width: number; height: number } };

/** Keys with a screen. The Neo's two touch points under its keys are buttons too, but not keys. */
const isKey = (c: { type: string; feedbackType?: string }): c is Button => c.type === "button" && c.feedbackType === "lcd";

export class DeckLink {
	deck?: StreamDeckWeb;
	#drawn = new Map<string, string>();
	#queue: Promise<void> = Promise.resolve();
	#last?: DeckState;
	#onChange: (name: string) => void;

	constructor(onChange: (name: string) => void) {
		this.#onChange = onChange;
		navigator.hid?.addEventListener("connect", () => void this.autoConnect());
		navigator.hid?.addEventListener("disconnect", () => void this.#checkGone());
	}

	/** Opens the first Stream Deck the app may use. */
	async autoConnect(): Promise<void> {
		if (this.deck) return;
		try {
			for (const deck of await getStreamDecks()) if (await this.#open(deck)) return;
		} catch (error) {
			console.error("Stream Deck open failed", error);
		}
	}

	/** Button-driven connect (a user gesture), for when automatic connect finds nothing. */
	async request(): Promise<void> {
		for (const deck of await requestStreamDecks()) if (await this.#open(deck)) return;
	}

	/** False (and closed again) for a deck with no key screens, such as the Pedal. */
	async #open(deck: StreamDeckWeb): Promise<boolean> {
		const controls = deck.CONTROLS as unknown as (Button | Lcd | { type: "encoder"; index: number })[];
		const keys = controls.filter(isKey);
		if (!keys.length) {
			await deck.close().catch(() => undefined);
			return false;
		}
		this.deck = deck;
		this.#drawn.clear();
		const layout: Layout = {
			model: deck.PRODUCT_NAME,
			columns: Math.max(...keys.map((b) => b.column)) + 1,
			rows: Math.max(...keys.map((b) => b.row)) + 1,
			dials: controls.filter((c) => c.type === "encoder").length,
			infoBar: deck.MODEL === DeviceModelId.NEO,
		};
		const slot = (b: Button) => b.row * layout.columns + b.column;

		deck.on("down", (c) => {
			if (c.type === "encoder") void api.dialNext(c.index);
			else if (isKey(c)) void api.keyDown(slot(c));
		});
		deck.on("up", (c) => {
			if (isKey(c)) void api.keyUp(slot(c));
		});
		deck.on("rotate", (c, amount) => void api.dialRotate(c.index, amount));
		deck.on("lcdShortPress", (c, position) => {
			const lcd = c as unknown as Lcd;
			const width = lcd.pixelSize.width / Math.max(1, layout.dials);
			void api.dialNext(Math.min(layout.dials - 1, Math.floor(position.x / width)));
		});
		deck.on("error", (error) => {
			console.error("Stream Deck error", error);
			void this.#close();
		});

		await api.device(layout, deck.PRODUCT_NAME);
		this.#onChange(deck.PRODUCT_NAME);
		if (this.#last) this.draw(this.#last);
		return true;
	}

	/** After any HID unplug: close our deck if no Elgato device is still open. */
	async #checkGone(): Promise<void> {
		if (!this.deck) return;
		const devices = await navigator.hid.getDevices();
		if (!devices.some((d) => d.vendorId === 0x0fd9 && d.opened)) await this.#close();
	}

	async #close(): Promise<void> {
		const deck = this.deck;
		this.deck = undefined;
		this.#drawn.clear();
		try {
			await deck?.close();
		} catch {
			// Already gone.
		}
		await api.device(null, "");
		this.#onChange("");
	}

	/** Writes only the keys and strip segments whose image changed. */
	draw(state: DeckState): void {
		this.#last = state;
		const deck = this.deck;
		if (!deck) return;
		const controls = deck.CONTROLS as unknown as (Button | Lcd)[];
		const columns = state.layout.columns;
		for (const button of controls.filter(isKey)) {
			const key = state.keys[button.row * columns + button.column];
			if (!key || this.#drawn.get(`k${button.index}`) === key.svg) continue;
			this.#drawn.set(`k${button.index}`, key.svg);
			const { width, height } = button.pixelSize ?? { width: 72, height: 72 };
			this.#enqueue(async () => deck.fillKeyBuffer(button.index, await rasterize(key.svg, width, height), { format: "rgba" }));
		}
		const lcd = controls.find((c): c is Lcd => c.type === "lcd-segment");
		if (lcd && state.bar) {
			if (this.#drawn.get("bar") !== state.bar) {
				this.#drawn.set("bar", state.bar);
				const { width, height } = lcd.pixelSize;
				this.#enqueue(async () => deck.fillLcd(lcd.id, await rasterize(state.bar, width, height), { format: "rgba" }));
			}
		} else if (lcd && state.dials.length) {
			const width = Math.floor(lcd.pixelSize.width / state.dials.length);
			const height = lcd.pixelSize.height;
			for (const dial of state.dials) {
				if (this.#drawn.get(`d${dial.index}`) === dial.svg) continue;
				this.#drawn.set(`d${dial.index}`, dial.svg);
				this.#enqueue(async () =>
					deck.fillLcdRegion(0, dial.index * width, 0, await rasterize(dial.svg, width, height), { format: "rgba", width, height }),
				);
			}
		}
	}

	/** One HID write at a time. */
	#enqueue(write: () => Promise<void>): void {
		this.#queue = this.#queue.then(write).catch((error) => console.error("Stream Deck write failed", error));
	}
}

const canvas = document.createElement("canvas");

/** SVG → RGBA pixels at the device's size. */
export async function rasterize(svg: string, width: number, height: number): Promise<Uint8Array> {
	const image = new Image();
	image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	await image.decode();
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(image, 0, 0, width, height);
	return new Uint8Array(ctx.getImageData(0, 0, width, height).data.buffer);
}
