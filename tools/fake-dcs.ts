/**
 * Fake DCS: speaks the DCS-BIOS protocol so the plugin can be tested without the game.
 *
 *   node tools/fake-dcs.ts --json <FA-18C_hornet.json> [--magnetic APU_CONTROL_SW:10]
 *   node tools/fake-dcs.ts --aircraft F-16C_50 --json <F-16C_50.json> [--magnetic HDPT_SW_L:10]
 *   node tools/fake-dcs.ts --play <recording.jsonl>
 *
 * --aircraft sets the aircraft (DCS-BIOS module name) it flies (default FA-18C_hornet); DCS's own
 * name for it (AH-64D_BLK_II for module AH-64D) goes in the stream.
 * Sim mode keeps a memory map, applies commands sent to UDP 7778 and sends
 * the export stream to 239.255.50.10:5010 at 30 frames a second.
 * --magnetic ID:seconds drops that switch back to 0 after the delay, like the
 * jet does with a magnetically held switch.
 * Play mode resends a file made by tools/record.ts.
 */
import dgram from "node:dgram";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { aircraftByModule, dcsName, DEFAULT_AIRCRAFT } from "../core/aircraft.data.ts";
import { DEFAULT_OPTIONS } from "../core/dcsbios/client.ts";
import type { Control } from "../core/dcsbios/controls.ts";
import { intOutput, loadControls } from "../core/dcsbios/controls.ts";
import { encodeFrame } from "../core/dcsbios/parser.ts";

const { values } = parseArgs({
	options: {
		json: { type: "string" },
		play: { type: "string" },
		aircraft: { type: "string", default: DEFAULT_AIRCRAFT.AIRCRAFT.module },
		magnetic: { type: "string", multiple: true, default: [] },
		group: { type: "string", default: DEFAULT_OPTIONS.exportGroup },
		port: { type: "string", default: String(DEFAULT_OPTIONS.exportPort) },
		"command-port": { type: "string", default: String(DEFAULT_OPTIONS.commandPort) },
	},
});

const out = dgram.createSocket({ type: "udp4", reuseAddr: true });
out.bind(() => {
	out.setMulticastTTL(1);
	out.setMulticastLoopback(true);
});
const sendFrame = (frame: Uint8Array) => out.send(frame, Number(values.port), values.group);

if (values.play) {
	play(values.play);
} else if (values.json) {
	simulate(values.json);
} else {
	console.error("Give --json <control file> or --play <recording>");
	process.exit(2);
}

function play(file: string): void {
	const packets = readFileSync(file, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as { t: number; data: string });
	if (packets.length === 0) throw new Error("empty recording");
	const loop = () => {
		const start = Date.now();
		for (const p of packets) setTimeout(() => sendFrame(Buffer.from(p.data, "base64")), p.t);
		setTimeout(loop, packets[packets.length - 1].t + 100 - (Date.now() - start));
	};
	console.log(`Playing ${packets.length} packets from ${file} (loops)`);
	loop();
}

function simulate(jsonPath: string): void {
	const aircraft = aircraftByModule(values.aircraft!);
	const controls = loadControls(jsonPath, aircraft ?? DEFAULT_AIRCRAFT);
	const memory = new Uint8Array(0x10000);
	const name = new TextEncoder().encode(aircraft ? dcsName(aircraft) : values.aircraft);
	memory.set(name.subarray(0, 23), 0);

	let low = 0xffff;
	let high = 0;
	for (const c of controls.values()) {
		for (const o of c.outputs) {
			low = Math.min(low, o.address);
			high = Math.max(high, o.address + (o.type === "string" ? o.max_length : 2));
		}
	}
	low &= ~1;
	high = (high + 1) & ~1;

	const magnetic = new Map(
		values.magnetic.map((m) => {
			const [id, seconds] = m.split(":");
			return [id, Number(seconds || 10) * 1000] as const;
		}),
	);
	const timers = new Map<string, NodeJS.Timeout>();

	const read = (c: Control) => {
		const o = intOutput(c)!;
		const word = memory[o.address] | (memory[o.address + 1] << 8);
		return (word & o.mask) >> o.shift_by;
	};
	const write = (c: Control, value: number) => {
		const o = intOutput(c)!;
		const v = Math.max(0, Math.min(o.max_value, value));
		const word = ((memory[o.address] | (memory[o.address + 1] << 8)) & ~o.mask) | ((v << o.shift_by) & o.mask);
		memory[o.address] = word & 0xff;
		memory[o.address + 1] = word >> 8;
		console.log(`${c.identifier} = ${v}`);
		const delay = magnetic.get(c.identifier);
		if (delay !== undefined) {
			clearTimeout(timers.get(c.identifier));
			if (v !== 0) {
				timers.set(
					c.identifier,
					setTimeout(() => {
						console.log(`${c.identifier} released by the jet`);
						write(c, 0);
					}, delay),
				);
			}
		}
	};

	const commands = dgram.createSocket({ type: "udp4", reuseAddr: true });
	commands.on("message", (msg) => {
		for (const line of msg.toString().split("\n").filter(Boolean)) {
			const [id, arg] = line.trim().split(/\s+/);
			const c = controls.get(id);
			const o = c && intOutput(c);
			if (!c || !o || arg === undefined) {
				console.log(`ignored: ${line}`);
				continue;
			}
			const v = read(c);
			if (arg === "TOGGLE") write(c, o.max_value === 1 ? 1 - v : (v + 1) % (o.max_value + 1));
			else if (arg === "INC") write(c, v + 1);
			else if (arg === "DEC") write(c, v - 1);
			else if (/^[+-]\d+$/.test(arg)) write(c, v + Number(arg));
			else if (/^\d+$/.test(arg)) write(c, Number(arg));
			else console.log(`ignored: ${line}`);
		}
	});
	commands.bind(Number(values["command-port"]));

	let counter = 0;
	setInterval(() => {
		counter = (counter + 1) & 0xff;
		sendFrame(
			encodeFrame(
				[
					{ address: 0, data: memory.slice(0, 24) },
					{ address: low, data: memory.slice(low, high) },
				],
				counter,
			),
		);
	}, 33);
	console.log(
		`Fake DCS: ${controls.size} controls, export to ${values.group}:${values.port}, commands on UDP ${values["command-port"]}`,
	);
}
