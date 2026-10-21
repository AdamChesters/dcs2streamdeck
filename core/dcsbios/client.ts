/**
 * Live link to DCS-BIOS: listens to the UDP export stream and sends commands.
 */
import dgram from "node:dgram";

import type { Control } from "./controls.ts";
import { intOutput, stringOutput } from "./controls.ts";
import { ExportParser } from "./parser.ts";

export type ClientOptions = {
	/** Multicast group of the export stream (DCS-BIOS default 239.255.50.10). */
	exportGroup: string;
	exportPort: number;
	/** Where DCS-BIOS listens for commands (default 127.0.0.1:7778). */
	commandHost: string;
	commandPort: number;
};

export const DEFAULT_OPTIONS: ClientOptions = {
	exportGroup: "239.255.50.10",
	exportPort: 5010,
	commandHost: "127.0.0.1",
	commandPort: 7778,
};

/** No frame for this long means DCS is not running (DCS-BIOS sends about 30 frames a second). */
const STALE_MS = 2000;

type Value = number | string;
type Watch = { control: Control; listener: (value: Value) => void; last?: Value };

export class DcsBiosClient {
	readonly parser = new ExportParser((changed) => this.#onFrame(changed));
	readonly options: ClientOptions;
	aircraft = "";
	#watches = new Set<Watch>();
	#statusListeners = new Set<() => void>();
	#socket?: dgram.Socket;
	#timer?: NodeJS.Timeout;
	#lastFrame = 0;
	#wasConnected = false;

	constructor(options: Partial<ClientOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	get connected(): boolean {
		return Date.now() - this.#lastFrame < STALE_MS;
	}

	start(): void {
		const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
		socket.on("message", (msg) => this.parser.push(msg));
		socket.on("error", (err) => console.error("dcs-bios socket error", err));
		socket.bind(this.options.exportPort, () => {
			socket.addMembership(this.options.exportGroup);
		});
		this.#socket = socket;
		this.#timer = setInterval(() => this.#checkStatus(), 500);
	}

	stop(): void {
		clearInterval(this.#timer);
		this.#socket?.close();
		this.#socket = undefined;
	}

	/** Sends one command, e.g. send("APU_CONTROL_SW", "TOGGLE"). */
	send(identifier: string, argument: string): void {
		this.#socket?.send(`${identifier} ${argument}\n`, this.options.commandPort, this.options.commandHost);
	}

	/** Current value of a control, or undefined before DCS has sent it. */
	read(control: Control): Value | undefined {
		if (!this.connected) return undefined;
		if (control.seat) return this.read(this.seatControl(control));
		const int = intOutput(control);
		if (int) return this.parser.readInt(int.address, int.mask, int.shift_by);
		const str = stringOutput(control);
		if (str) return this.parser.readString(str.address, str.max_length);
		return undefined;
	}

	/** A control both seats have, as the player's own seat's (the first seat until DCS says). */
	seatControl(control: Control): Control {
		if (!control.seat) return control;
		const at = this.read(control.seat.position);
		return control.seat.variants[typeof at === "number" ? at : 0] ?? control.seat.variants[0];
	}

	/** Calls `listener` whenever the control's value changes in DCS. Returns an unsubscribe function. */
	watch(control: Control, listener: (value: Value) => void): () => void {
		const watch: Watch = { control, listener, last: this.read(control) };
		this.#watches.add(watch);
		return () => this.#watches.delete(watch);
	}

	/** Calls `listener` when DCS connects/disconnects or the aircraft changes. */
	onStatus(listener: () => void): () => void {
		this.#statusListeners.add(listener);
		return () => this.#statusListeners.delete(listener);
	}

	#onFrame(changed: ReadonlySet<number>): void {
		this.#lastFrame = Date.now();
		const aircraft = this.parser.readString(0, 24);
		if (aircraft !== this.aircraft) {
			this.aircraft = aircraft;
			this.#emitStatus();
		}
		this.#checkStatus();
		for (const watch of this.#watches) {
			if (watch.last !== undefined && !touches(watch.control, changed)) continue;
			const value = this.read(watch.control);
			if (value === undefined || value === watch.last) continue;
			watch.last = value;
			watch.listener(value);
		}
	}

	#checkStatus(): void {
		const connected = this.connected;
		if (connected === this.#wasConnected) return;
		this.#wasConnected = connected;
		if (!connected) {
			for (const watch of this.#watches) watch.last = undefined;
		}
		this.#emitStatus();
	}

	#emitStatus(): void {
		for (const listener of this.#statusListeners) listener();
	}
}

function touches(control: Control, changed: ReadonlySet<number>): boolean {
	if (control.seat) return [control.seat.position, ...control.seat.variants].some((c) => touches(c, changed));
	for (const out of control.outputs) {
		const length = out.type === "string" ? out.max_length : 2;
		for (let a = out.address & ~1; a < out.address + length; a += 2) {
			if (changed.has(a)) return true;
		}
	}
	return false;
}
