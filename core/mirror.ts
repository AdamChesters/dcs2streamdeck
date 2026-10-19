/**
 * VR mirror: a local web page that shows the deck, served by the plugin and by the app alike.
 * OpenKneeboard shows it as a tab (see openkneeboard.ts), or as a Web Dashboard tab at
 * http://127.0.0.1:<port>/.
 */
import { readFile } from "node:fs/promises";
import http from "node:http";

import type { DialView, InfoBarView } from "./render.ts";

export type Tile =
	| { kind: "key"; device: string; column: number; row: number; svg: string }
	| { kind: "dial"; device: string; column: number; dial: DialView };

/** `dials`: touch strip segments (0 = none). `infoBar`: a Stream Deck Neo, drawn with its bar. */
export type DeviceView = { id: string; name: string; columns: number; rows: number; dials: number; infoBar: boolean };

export type MirrorSnapshot = { devices: DeviceView[]; tiles: Tile[]; bar: InfoBarView };

export class MirrorState {
	readonly devices = new Map<string, DeviceView>();
	readonly tiles = new Map<string, Tile>();
	bar: InfoBarView = { text: "NO DCS", live: false };
	#listeners = new Set<() => void>();

	setDevice(device: DeviceView): void {
		this.devices.set(device.id, device);
		this.#changed();
	}

	setTile(id: string, tile: Tile): void {
		this.tiles.set(id, tile);
		this.#changed();
	}

	/** Shown only on the mirror's Neo bar; the plugin draws nothing on the real one. */
	setBar(bar: InfoBarView): void {
		if (bar.text === this.bar.text && bar.live === this.bar.live) return;
		this.bar = bar;
		this.#changed();
	}

	removeTile(id: string): void {
		if (this.tiles.delete(id)) this.#changed();
	}

	/** Everything at once (the app sends its whole deck on each change). */
	replace({ devices, tiles, bar }: MirrorSnapshot): void {
		this.devices.clear();
		for (const device of devices) this.devices.set(device.id, device);
		this.tiles.clear();
		tiles.forEach((tile, i) => this.tiles.set(String(i), tile));
		this.bar = bar;
		this.#changed();
	}

	snapshot(): MirrorSnapshot {
		return { devices: [...this.devices.values()], tiles: [...this.tiles.values()], bar: this.bar };
	}

	onChange(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	#changed(): void {
		for (const listener of this.#listeners) listener();
	}
}

/**
 * Serves the mirror page and a Server-Sent Events stream of state snapshots. While the port is
 * taken (the plugin and the app share it), tries again every `retryMs`, so whichever is still
 * running takes over when the other closes.
 */
export function startMirrorServer(state: MirrorState, port: number, pagePath: string, retryMs = 15_000): http.Server {
	const server = http.createServer(async (req, res) => {
		if (req.url === "/events") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			let pending: NodeJS.Timeout | undefined;
			const send = () => res.write(`data: ${JSON.stringify(state.snapshot())}\n\n`);
			// At most 20 updates a second; a burst of changes becomes one snapshot.
			const stop = state.onChange(() => {
				pending ??= setTimeout(() => {
					pending = undefined;
					send();
				}, 50);
			});
			req.on("close", () => {
				stop();
				clearTimeout(pending);
			});
			send();
			return;
		}
		if (req.url === "/" || req.url?.startsWith("/?")) {
			try {
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				res.end(await readFile(pagePath));
			} catch {
				res.writeHead(500).end("mirror page missing");
			}
			return;
		}
		res.writeHead(404).end();
	});
	server.on("error", (err: NodeJS.ErrnoException) => {
		if (err.code !== "EADDRINUSE") return console.error("mirror server error", err);
		setTimeout(() => {
			server.close();
			server.listen(port, "127.0.0.1");
		}, retryMs).unref();
	});
	server.listen(port, "127.0.0.1");
	return server;
}
