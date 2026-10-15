import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeFrame, ExportParser } from "../src/core/dcsbios/parser.ts";

const word = (v: number) => new Uint8Array([v & 0xff, v >> 8]);

test("decodes a frame and reports changed words at frame end", () => {
	const frames: number[][] = [];
	const parser = new ExportParser((changed) => frames.push([...changed].sort((a, b) => a - b)));
	parser.push(encodeFrame([{ address: 0x74c2, data: word(0x0300) }], 1));
	assert.equal(frames.length, 1);
	assert.deepEqual(frames[0], [0x74c2, 0xfffe]);
	assert.equal(parser.readInt(0x74c2, 0x0100, 8), 1);
	assert.equal(parser.readInt(0x74c2, 0x0600, 9), 1);
});

test("handles frames split across packets and leading noise", () => {
	let count = 0;
	const parser = new ExportParser(() => count++);
	const frame = encodeFrame([{ address: 0, data: new TextEncoder().encode("FA-18C_hornet\0\0\0") }], 7);
	parser.push(new Uint8Array([1, 2, 3, 0x55, 9]));
	parser.push(frame.subarray(0, 9));
	parser.push(frame.subarray(9));
	assert.equal(count, 1);
	assert.equal(parser.readString(0, 24), "FA-18C_hornet");
});

test("a frame with no new data still ends (update counter changes)", () => {
	let count = 0;
	const parser = new ExportParser(() => count++);
	parser.push(encodeFrame([{ address: 0x10, data: word(5) }], 1));
	parser.push(encodeFrame([{ address: 0x10, data: word(5) }], 2));
	assert.equal(count, 2);
});

test("only words that changed are reported", () => {
	const frames: number[][] = [];
	const parser = new ExportParser((changed) => frames.push([...changed].filter((a) => a !== 0xfffe)));
	parser.push(encodeFrame([{ address: 0x20, data: new Uint8Array([1, 0, 2, 0]) }], 1));
	parser.push(encodeFrame([{ address: 0x20, data: new Uint8Array([1, 0, 3, 0]) }], 2));
	assert.deepEqual(frames, [[0x20, 0x22], [0x22]]);
});
