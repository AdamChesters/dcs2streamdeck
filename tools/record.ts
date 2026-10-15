/**
 * Records the DCS-BIOS export stream to a file for tests and tools/fake-dcs.ts --play.
 *
 *   node tools/record.ts recordings/cold-start.jsonl [seconds]
 */
import dgram from "node:dgram";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

import { DEFAULT_OPTIONS } from "../core/dcsbios/client.ts";

const [file, seconds] = process.argv.slice(2);
if (!file) {
	console.error("usage: node tools/record.ts <file.jsonl> [seconds]");
	process.exit(2);
}
mkdirSync(path.dirname(file), { recursive: true });
const out = createWriteStream(file);
const start = Date.now();
let count = 0;

const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
socket.on("message", (msg) => {
	out.write(`${JSON.stringify({ t: Date.now() - start, data: msg.toString("base64") })}\n`);
	count++;
});
socket.bind(DEFAULT_OPTIONS.exportPort, () => socket.addMembership(DEFAULT_OPTIONS.exportGroup));

const stop = () => {
	socket.close();
	out.end(() => {
		console.log(`Saved ${count} packets to ${file}`);
		process.exit(0);
	});
};
process.on("SIGINT", stop);
if (seconds) setTimeout(stop, Number(seconds) * 1000);
console.log(`Recording ${DEFAULT_OPTIONS.exportGroup}:${DEFAULT_OPTIONS.exportPort} to ${file} (Ctrl+C to stop)`);
