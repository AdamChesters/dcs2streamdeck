/** The drawn deck's geometry in design pixels: the deck view draws it, the deck window takes its shape. */
import type { Layout } from "../../main/engine.ts";

export const KEY = 96;
export const GAP = 16;
export const PAD = 24;
export const STRIP_H = 54;
export const KNOB = 50;
/** The Neo's info bar, as wide as the two keys above it (248 × 58 on the device). */
export const BAR_H = Math.round(((2 * KEY + GAP) * 58) / 248);

export function deckSize({ columns, rows, dials, infoBar }: Layout): { width: number; height: number } {
	const width = PAD * 2 + columns * KEY + (columns - 1) * GAP;
	const keysH = rows * KEY + (rows - 1) * GAP;
	const dialsH = dials ? GAP + STRIP_H + 18 + KNOB : 0;
	const barH = infoBar ? GAP + BAR_H : 0;
	return { width, height: PAD * 2 + keysH + dialsH + barH };
}
