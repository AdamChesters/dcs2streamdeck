/**
 * OpenKneeboard plugin file: opened in Windows, it makes OpenKneeboard (1.9 or later) install a
 * "dcs2streamdeck" tab type showing the VR mirror page, so nobody types its address.
 * Format: https://openkneeboard.com/api/web-dashboards/plugins/
 */
import { crc32 } from "node:zlib";

import { PRODUCT } from "./aircraft.data.ts";

/** Never change: OpenKneeboard knows the plugin and its tabs by these. */
const ID = "github.com/AdamChesters/dcs2streamdeck";
const TAB_ID = `${ID};deck`;
/** Bump when the file's content changes: OpenKneeboard offers an update only for a new version. */
const VERSION = "1.0.0";

export const OPENKNEEBOARD_FILE = "dcs2streamdeck.OpenKneeboardPlugin";

export function openKneeboardManifest(port: number) {
	return {
		ID,
		Metadata: {
			PluginName: "dcs2streamdeck",
			PluginReadableVersion: VERSION,
			// Another port is another version, so OpenKneeboard takes the new address.
			PluginSemanticVersion: port === PRODUCT.mirrorPort ? VERSION : `${VERSION}+port.${port}`,
			OKBMinimumVersion: "1.9",
			Author: "Adam Chesters",
			Website: "https://github.com/AdamChesters/dcs2streamdeck",
		},
		TabTypes: [
			{
				ID: TAB_ID,
				Name: "dcs2streamdeck",
				Glyph: "", // Segoe MDL2 "Game"
				Implementation: "WebBrowser",
				// The page then asks for its deck's own size.
				ImplementationArgs: { URI: `http://127.0.0.1:${port}/`, InitialSize: { Width: 1024, Height: 640 } },
			},
		],
	};
}

/** The plugin file: a zip holding v1.json. */
export function openKneeboardPlugin(port: number): Buffer {
	return zip("v1.json", Buffer.from(JSON.stringify(openKneeboardManifest(port), null, 2)));
}

/** A zip with one stored (uncompressed) file, dated 1 January 1980. */
function zip(name: string, data: Buffer): Buffer {
	const fileName = Buffer.from(name);
	const crc = crc32(data);
	const fields = (header: Buffer, at: number) => {
		header.writeUInt16LE(20, at); // version needed: 2.0
		header.writeUInt16LE(0, at + 2); // flags
		header.writeUInt16LE(0, at + 4); // stored
		header.writeUInt16LE(0, at + 6); // time
		header.writeUInt16LE(0x21, at + 8); // date
		header.writeUInt32LE(crc, at + 10);
		header.writeUInt32LE(data.length, at + 14);
		header.writeUInt32LE(data.length, at + 18);
		header.writeUInt16LE(fileName.length, at + 22);
	};
	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034b50, 0);
	fields(local, 4);
	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014b50, 0);
	central.writeUInt16LE(20, 4); // version made by
	fields(central, 6);
	// Extra, comment, disk, attributes and the local header's offset (0) stay zero.
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(1, 8);
	end.writeUInt16LE(1, 10);
	end.writeUInt32LE(central.length + fileName.length, 12);
	end.writeUInt32LE(local.length + fileName.length + data.length, 16);
	return Buffer.concat([local, fileName, data, central, fileName, end]);
}
