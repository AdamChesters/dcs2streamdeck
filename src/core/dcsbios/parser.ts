/**
 * Decoder for the DCS-BIOS export stream.
 *
 * The stream is a copy of a 64 KiB memory map. Each frame starts with the
 * sync bytes 0x55 0x55 0x55 0x55, followed by write records:
 * address (u16 LE), byte count (u16 LE), data. A write to address 0xFFFE
 * (the update counter) is the last write of each frame.
 */

const FRAME_END_ADDRESS = 0xfffe;

const S = {
	addressLow: 0,
	addressHigh: 1,
	countLow: 2,
	countHigh: 3,
	data: 4,
	waitForSync: 5,
} as const;
type State = (typeof S)[keyof typeof S];

export class ExportParser {
	readonly memory = new Uint8Array(0x10000);
	#state: State = S.waitForSync;
	#syncCount = 0;
	#address = 0;
	#count = 0;
	#changed = new Set<number>();
	#onFrame: (changedWords: ReadonlySet<number>) => void;

	/** @param onFrame Called at the end of each frame with the word addresses that changed. */
	constructor(onFrame: (changedWords: ReadonlySet<number>) => void) {
		this.#onFrame = onFrame;
	}

	push(chunk: Uint8Array): void {
		for (const byte of chunk) this.#step(byte);
	}

	#step(byte: number): void {
		switch (this.#state) {
			case S.addressLow:
				this.#address = byte;
				this.#state = S.addressHigh;
				break;
			case S.addressHigh:
				this.#address |= byte << 8;
				this.#state = this.#address === 0x5555 ? S.waitForSync : S.countLow;
				break;
			case S.countLow:
				this.#count = byte;
				this.#state = S.countHigh;
				break;
			case S.countHigh:
				this.#count |= byte << 8;
				this.#state = this.#count === 0 ? S.addressLow : S.data;
				break;
			case S.data: {
				const address = this.#address;
				if (this.memory[address] !== byte) {
					this.memory[address] = byte;
					this.#changed.add(address & ~1);
				}
				this.#address = (address + 1) & 0xffff;
				this.#count--;
				if (this.#count === 0) {
					this.#state = S.addressLow;
					if (address === FRAME_END_ADDRESS + 1) this.#endFrame();
				}
				break;
			}
			case S.waitForSync:
				break;
		}

		// Same rule as the official Arduino library: four 0x55 bytes in a row
		// always start a new frame, whatever state the parser is in.
		if (byte === 0x55) {
			this.#syncCount++;
			if (this.#syncCount === 4) {
				this.#state = S.addressLow;
				this.#syncCount = 0;
			}
		} else {
			this.#syncCount = 0;
		}
	}

	#endFrame(): void {
		if (this.#changed.size === 0) return;
		const changed = this.#changed;
		this.#changed = new Set();
		this.#onFrame(changed);
	}

	/** Reads `(word & mask) >> shift` at an even address. */
	readInt(address: number, mask: number, shift: number): number {
		const word = this.memory[address] | (this.memory[address + 1] << 8);
		return (word & mask) >> shift;
	}

	/** Reads a fixed-length string, stopping at the first NUL byte. */
	readString(address: number, maxLength: number): string {
		let out = "";
		for (let i = 0; i < maxLength; i++) {
			const byte = this.memory[address + i];
			if (byte === 0) break;
			out += String.fromCharCode(byte);
		}
		return out;
	}
}

/** Encodes write records as one export frame (used by the fake DCS and tests). */
export function encodeFrame(writes: { address: number; data: Uint8Array }[], updateCounter: number): Uint8Array {
	const all = [...writes, { address: FRAME_END_ADDRESS, data: new Uint8Array([updateCounter & 0xff, 0]) }];
	const size = 4 + all.reduce((n, w) => n + 4 + w.data.length, 0);
	const out = new Uint8Array(size);
	out.set([0x55, 0x55, 0x55, 0x55]);
	let i = 4;
	for (const w of all) {
		out[i++] = w.address & 0xff;
		out[i++] = w.address >> 8;
		out[i++] = w.data.length & 0xff;
		out[i++] = w.data.length >> 8;
		out.set(w.data, i);
		i += w.data.length;
	}
	return out;
}
