/**
 * Key and dial-strip images as SVG. The same SVG goes to the Stream Deck and to
 * every on-screen copy of the deck.
 */

export type Colour = "green" | "yellow" | "red" | "white" | "blue";

export type Light = { colour: Colour; on: boolean };

/** The picture in the middle of a key. */
export type Glyph =
	/** 2- or 3-position switch, pointing as it does from the seat. The knob can be a gear wheel or a hook. */
	| { kind: "lever"; at: "up" | "down" | "left" | "right" | "middle"; knob?: "wheel" | "hook" }
	/** Guarded switch: striped cover closed, or open with the switch under it. */
	| { kind: "guard"; open: boolean }
	/** Rotary selector with `count` positions. */
	| { kind: "rotary"; position: number; count: number }
	/** Push button. */
	| { kind: "button"; pressed: boolean }
	/** One cockpit light (legend) that can show several colours, e.g. L BAR. */
	| { kind: "lens"; legend: string; lights: Light[] }
	/** AOA indexer: high chevron, on-speed donut, low chevron. */
	| { kind: "aoa"; high: Light; normal: Light; low: Light }
	/** Flaps indicator: HALF, FULL (green) and FLAPS (yellow). */
	| { kind: "flaps"; half: Light; full: Light; flaps: Light }
	/** Gear indicator: nose, left, right greens and the red handle light. */
	| { kind: "gear"; nose: Light; left: Light; right: Light; handle: Light }
	/** Several separate lights on one key. */
	| { kind: "stack"; lights: Light[] };

export type KeyLook = {
	title: string;
	/** State text, e.g. "ON", "OFF", "RIGHT". */
	state: string;
	/** Lit keys get the "on" colour. */
	lit: boolean;
	/** False when DCS is not sending data. */
	live: boolean;
	/** Text shown when not live (default "NO DCS"). */
	offline?: string;
	/** Colour when lit, from the cockpit light (default green). */
	colour?: Colour;
	glyph?: Glyph;
};

const LIT: Record<Colour, { bg: string; text: string; title: string }> = {
	green: { bg: "#1f7a2e", text: "#c8ffd0", title: "#ffffff" },
	yellow: { bg: "#c99a06", text: "#1a1400", title: "#1a1400" },
	red: { bg: "#a3241f", text: "#ffd6d2", title: "#ffffff" },
	white: { bg: "#d8d8d8", text: "#111111", title: "#111111" },
	blue: { bg: "#1f4f9a", text: "#d2e4ff", title: "#ffffff" },
};

/** Lamp lens colours (brighter than the key backgrounds). */
const LENS: Record<Colour, string> = {
	green: "#3ddc62",
	yellow: "#ffc21a",
	red: "#ff3b30",
	white: "#f2f2f2",
	blue: "#4c8dff",
};
const LENS_OFF = "#262626";

const SIZE = 144;
const FONT = 'font-family="Arial, sans-serif"';

export function keySvg(look: KeyLook): string {
	const g = look.glyph;
	if (g && (g.kind === "lens" || g.kind === "aoa" || g.kind === "stack" || g.kind === "flaps" || g.kind === "gear")) {
		return lightKeySvg(look, g);
	}
	const lit = look.live && look.lit ? LIT[look.colour ?? "green"] : undefined;
	const bg = !look.live ? "#1a1a1a" : lit ? lit.bg : "#2a2a2a";
	const stateColour = !look.live ? "#777" : lit ? lit.text : "#bbbbbb";
	const state = look.live ? look.state : (look.offline ?? "NO DCS");
	const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
		`<rect width="${SIZE}" height="${SIZE}" rx="16" fill="${bg}"/>`;
	if (!g) {
		return (
			open +
			titleLines(look.title, lit?.title ?? "#ffffff") +
			`<text x="72" y="118" ${FONT} font-size="${fit(state, 30)}" font-weight="bold" fill="${stateColour}" text-anchor="middle">${escape(state)}</text>` +
			`</svg>`
		);
	}
	// Title on top, the switch picture in the middle, state at the bottom.
	const ink = !look.live ? "#666" : lit ? lit.text : "#d6d6d6";
	return (
		open +
		smallTitle(look.title, lit?.title ?? "#ffffff") +
		switchGlyph(g, ink, look.live) +
		`<text x="72" y="134" ${FONT} font-size="${fit(state, 22)}" font-weight="bold" fill="${stateColour}" text-anchor="middle">${escape(state)}</text>` +
		`</svg>`
	);
}

/** Keys that show only cockpit lights: dark key, lit lenses. */
function lightKeySvg(look: KeyLook, g: Extract<Glyph, { kind: "lens" | "aoa" | "stack" | "flaps" | "gear" }>): string {
	const on = (l: Light) => (look.live && l.on ? LENS[l.colour] : LENS_OFF);
	// A small labelled lens, like one cell of a cockpit indicator panel.
	const cell = (l: Light, x: number, y: number, w: number, h: number, label: string) => {
		const lit = look.live && l.on;
		const size = Math.min(h * 0.55, fit(label, 20, w - 8));
		return (
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${on(l)}" stroke="#3a3a3a" stroke-width="2"/>` +
			`<text x="${x + w / 2}" y="${y + h / 2 + size * 0.36}" ${FONT} font-size="${size}" font-weight="bold" fill="${lit ? "#141414" : "#5c5c5c"}" text-anchor="middle">${escape(label)}</text>`
		);
	};
	let body = "";
	if (g.kind === "lens") {
		const lit = look.live ? g.lights.find((l) => l.on) : undefined;
		const legendSize = Math.min(30, fit(g.legend, 30, 100));
		body =
			`<rect x="14" y="34" width="116" height="76" rx="10" fill="${lit ? LENS[lit.colour] : LENS_OFF}" stroke="#3a3a3a" stroke-width="2"/>` +
			`<text x="72" y="${72 + legendSize * 0.35}" ${FONT} font-size="${legendSize}" font-weight="bold" fill="${lit ? "#141414" : "#5c5c5c"}" text-anchor="middle">${escape(g.legend)}</text>`;
	} else if (g.kind === "aoa") {
		// Like the cockpit indexer: top chevron points down (slow), bottom points up (fast).
		body =
			`<text x="72" y="20" ${FONT} font-size="15" fill="#9a9a9a" text-anchor="middle">${escape(look.title)}</text>` +
			`<polyline points="40,34 72,56 104,34" fill="none" stroke="${on(g.high)}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` +
			`<circle cx="72" cy="80" r="12" fill="none" stroke="${on(g.normal)}" stroke-width="8"/>` +
			`<polyline points="40,126 72,104 104,126" fill="none" stroke="${on(g.low)}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`;
	} else if (g.kind === "flaps") {
		body =
			`<text x="72" y="20" ${FONT} font-size="15" fill="#9a9a9a" text-anchor="middle">${escape(look.title)}</text>` +
			cell(g.half, 14, 30, 56, 44, "HALF") +
			cell(g.full, 74, 30, 56, 44, "FULL") +
			cell(g.flaps, 14, 82, 116, 44, "FLAPS");
	} else if (g.kind === "gear") {
		// Like the cockpit panel: nose on top, left and right below; the handle light underneath
		// (offline, the offline text takes the handle's place).
		body =
			`<text x="72" y="20" ${FONT} font-size="15" fill="#9a9a9a" text-anchor="middle">${escape(look.title)}</text>` +
			cell(g.nose, 47, 28, 50, 34, "N") +
			cell(g.left, 14, 68, 50, 34, "L") +
			cell(g.right, 80, 68, 50, 34, "R") +
			(look.live ? cell(g.handle, 14, 108, 116, 24, "HANDLE") : "");
	} else if (g.kind === "stack") {
		const n = Math.max(1, g.lights.length);
		const h = Math.min(30, Math.floor(88 / n) - 6);
		body =
			smallTitle(look.title, "#cfcfcf") +
			g.lights
				.map((l, i) => `<rect x="24" y="${40 + i * (h + 6)}" width="96" height="${h}" rx="6" fill="${on(l)}" stroke="#3a3a3a" stroke-width="2"/>`)
				.join("");
	}
	const offline = look.live
		? ""
		: `<text x="72" y="136" ${FONT} font-size="14" font-weight="bold" fill="#888" text-anchor="middle">${escape(look.offline ?? "NO DCS")}</text>`;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
		`<rect width="${SIZE}" height="${SIZE}" rx="16" fill="${look.live ? "#161616" : "#121212"}"/>` +
		body +
		offline +
		`</svg>`
	);
}

/** Lever, rotary or push-button picture, centred at (72, 80). */
function switchGlyph(g: Glyph, ink: string, live: boolean): string {
	const plate = `<rect x="50" y="58" width="44" height="44" rx="8" fill="#000" fill-opacity="0.28"/>`;
	const lever = (x: number, y: number) =>
		`<line x1="72" y1="80" x2="${x}" y2="${y}" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>` +
		`<circle cx="${x}" cy="${y}" r="7" fill="${ink}"/>` +
		`<circle cx="72" cy="80" r="6" fill="#000" fill-opacity="0.45"/>`;
	switch (g.kind) {
		case "lever": {
			if (!live) return plate + `<circle cx="72" cy="80" r="9" fill="${ink}"/>`;
			if (g.at === "middle") return plate + `<circle cx="72" cy="80" r="11" fill="${ink}"/>`;
			if (g.at === "left" || g.at === "right") return plate + lever(g.at === "left" ? 50 : 94, 80);
			const up = g.at === "up";
			const y = up ? 54 : 100;
			const stem = `<line x1="72" y1="80" x2="72" y2="${y}" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>`;
			if (g.knob === "wheel") {
				// Gear handle: a wheel-shaped knob.
				return (
					plate +
					stem +
					`<circle cx="72" cy="${y}" r="13" fill="#000" fill-opacity="0.35" stroke="${ink}" stroke-width="5"/>` +
					`<line x1="59" y1="${y}" x2="85" y2="${y}" stroke="${ink}" stroke-width="3"/><line x1="72" y1="${y - 13}" x2="72" y2="${y + 13}" stroke="${ink}" stroke-width="3"/>`
				);
			}
			if (g.knob === "hook") {
				// Hook handle: a hook-shaped knob.
				const d = up ? -1 : 1;
				return (
					plate +
					stem +
					`<path d="M72 ${y} q0 ${d * 14} 12 ${d * 14} q10 0 10 ${-d * 10}" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`
				);
			}
			return plate + lever(72, up ? 58 : 102);
		}
		case "guard":
			// Red-and-black striped cover; open shows the switch lever under it.
			return g.open
				? plate +
						lever(72, 102) +
						`<rect x="48" y="40" width="48" height="12" rx="3" fill="#c0392b"/><path d="M52 40 l8 12 M64 40 l8 12 M76 40 l8 12 M88 40 l6 9" stroke="#111" stroke-width="4"/>`
				: `<rect x="46" y="54" width="52" height="54" rx="8" fill="#c0392b" stroke="${ink}" stroke-width="2"/>` +
						`<path d="M46 66 l20 -12 M46 82 l36 -28 M46 98 l52 -40 M58 108 l40 -31 M78 108 l20 -15" stroke="#111" stroke-width="6"/>`;
		case "rotary": {
			const count = Math.max(2, g.count);
			const angle = (i: number) => ((-135 + (270 * i) / (count - 1)) * Math.PI) / 180;
			const ticks = Array.from({ length: count }, (_, i) => {
				const a = angle(i);
				return `<line x1="${72 + 26 * Math.sin(a)}" y1="${80 - 26 * Math.cos(a)}" x2="${72 + 31 * Math.sin(a)}" y2="${80 - 31 * Math.cos(a)}" stroke="${ink}" stroke-opacity="0.6" stroke-width="2"/>`;
			}).join("");
			const a = angle(Math.min(count - 1, Math.max(0, g.position)));
			const pointer = live
				? `<line x1="72" y1="80" x2="${72 + 17 * Math.sin(a)}" y2="${80 - 17 * Math.cos(a)}" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`
				: "";
			return ticks + `<circle cx="72" cy="80" r="21" fill="#000" fill-opacity="0.3" stroke="${ink}" stroke-width="3"/>` + pointer;
		}
		case "button":
			return g.pressed && live
				? `<circle cx="72" cy="80" r="19" fill="${ink}"/>`
				: `<circle cx="72" cy="80" r="19" fill="#000" fill-opacity="0.25" stroke="${ink}" stroke-width="3"/>`;
		default:
			return "";
	}
}

/** One or two short title lines above a glyph. */
function smallTitle(title: string, colour: string): string {
	const lines = wrap(title, 14).slice(0, 2);
	const y = lines.length === 1 ? [26] : [20, 40];
	return lines
		.map(
			(line, i) =>
				`<text x="72" y="${y[i]}" ${FONT} font-size="${Math.min(lines.length === 1 ? 20 : 17, fit(line, 20))}" fill="${colour}" text-anchor="middle">${escape(line)}</text>`,
		)
		.join("");
}

export type DialView = {
	title: string;
	value: string;
	/** 0–100. */
	percent: number;
	/** Labels of all knobs on this dial; `index` is the active one. */
	functions: string[];
	index: number;
	live: boolean;
};

/** One dial's part of the touch strip (Stream Deck + segment, 200 × 100). */
export function dialSvg(view: DialView, width = 200, height = 100): string {
	const pad = 14;
	const barWidth = width - pad * 2;
	const fill = Math.round((barWidth * Math.max(0, Math.min(100, view.percent))) / 100);
	const dots =
		view.functions.length > 1
			? view.functions
					.map((_, i) => `<circle cx="${pad + 3 + i * 11}" cy="${height - 10}" r="3" fill="${i === view.index ? "#ffffff" : "#555"}"/>`)
					.join("")
			: "";
	const valueColour = view.live ? "#ffffff" : "#777";
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		`<rect width="${width}" height="${height}" fill="#101010"/>` +
		`<text x="${pad}" y="24" font-family="Arial, sans-serif" font-size="${Math.min(17, fit(view.title, 17, width - pad * 2))}" fill="#d0d0d0">${escape(view.title)}</text>` +
		`<text x="${pad}" y="58" font-family="Arial, sans-serif" font-size="${fit(view.value, view.live ? 28 : 20, width - pad * 2)}" font-weight="bold" fill="${valueColour}">${escape(view.value)}</text>` +
		`<rect x="${pad}" y="70" width="${barWidth}" height="6" rx="3" fill="#3a3a3a"/>` +
		`<rect x="${pad}" y="70" width="${fill}" height="6" rx="3" fill="#4fc06a"/>` +
		dots +
		`</svg>`
	);
}

/** What the Stream Deck Neo's info bar shows: the aircraft DCS flies, or why there is none. */
export type InfoBarView = { text: string; live: boolean };

/** The Stream Deck Neo's info bar (248 × 58): DCS on the left, the time on the right. */
export function infoBarSvg(view: InfoBarView, time: string, width = 248, height = 58): string {
	const pad = 12;
	const y = Math.round(height / 2 + 8);
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		`<rect width="${width}" height="${height}" fill="#101010"/>` +
		`<text x="${pad}" y="${y}" ${FONT} font-size="${fit(view.text, 22, width - pad * 3 - 90)}" font-weight="bold" fill="${view.live ? "#ffffff" : "#777"}">${escape(view.text)}</text>` +
		`<text x="${width - pad}" y="${y}" ${FONT} font-size="20" fill="#d0d0d0" text-anchor="end">${escape(time)}</text>` +
		`</svg>`
	);
}

export function svgDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function titleLines(title: string, colour: string): string {
	const lines = wrap(title, 11).slice(0, 2);
	const y = lines.length === 1 ? [52] : [40, 70];
	return lines
		.map(
			(line, i) =>
				`<text x="72" y="${y[i]}" font-family="Arial, sans-serif" font-size="${fit(line, 26)}" fill="${colour}" text-anchor="middle">${escape(line)}</text>`,
		)
		.join("");
}

function wrap(text: string, width: number): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		if (line && line.length + 1 + word.length > width) {
			lines.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	if (line) lines.push(line);
	return lines.length ? lines : [""];
}

/** Font size that keeps `text` inside `room` pixels (Arial is about 0.62 em per capital letter). */
function fit(text: string, max: number, room = 130): number {
	return Math.max(12, Math.min(max, Math.floor(room / (0.62 * Math.max(1, text.length)))));
}

function escape(text: string): string {
	return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
