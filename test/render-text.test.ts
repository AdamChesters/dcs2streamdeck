import assert from "node:assert/strict";
import { test } from "node:test";

import { keySvg } from "../core/render.ts";

/** The text lines of a key picture above its state line, with their font sizes. */
function titleLines(svg: string): { text: string; size: number; y: number }[] {
	return [...svg.matchAll(/<text x="72" y="(\d+)"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)]
		.map(([, y, size, text]) => ({ text, size: Number(size), y: Number(y) }))
		.filter((l) => l.y < 100);
}

test("a long key title shrinks and wraps; no word is cut and nothing leaves the key", () => {
	for (const glyph of [undefined, { kind: "button" as const, pressed: false }]) {
		for (const title of ["PTT/RTS ICS", "Up-Front Display RTS Rocker Switch", "IFF MODE 1 Selector, DIGIT 1 Up", "Fire and Bleed Air Test Switch TEST B Extra Long Words Here"]) {
			const lines = titleLines(keySvg({ title, state: "OFF", lit: false, live: true, glyph }));
			assert.equal(lines.map((l) => l.text).join(" "), title, `all of "${title}" is there, in order`);
			for (const l of lines) assert.ok(l.size * 0.62 * l.text.length <= 131, `"${l.text}" fits across the key`);
			assert.ok(lines.every((l) => l.y > 0 && l.y < (glyph ? 50 : 90)), `"${title}" stays above the ${glyph ? "picture" : "state"}`);
		}
	}
});
