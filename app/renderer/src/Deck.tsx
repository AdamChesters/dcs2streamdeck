import { useEffect, useRef, useState } from "react";

import type { DeckState } from "./api.ts";
import { BAR_H, deckSize, GAP, KEY, KNOB, STRIP_H } from "./deck-size.ts";

export type Selection = { kind: "key" | "dial"; index: number } | null;

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * The deck, drawn like the device: grey body, glass keys, the touch strip and knobs.
 * Scales to fill its container.
 */
export function Deck({
	state,
	selected,
	onSelect,
}: {
	state: DeckState;
	selected?: Selection;
	onSelect?: (selection: Selection) => void;
}) {
	const box = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);
	const size = deckSize(state.layout);

	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const fit = () => setScale(Math.min(el.clientWidth / size.width, el.clientHeight / size.height));
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(el);
		return () => observer.disconnect();
	}, [size.width, size.height]);

	const { columns, dials } = state.layout;
	const stripW = columns * KEY + (columns - 1) * GAP;
	const segment = dials ? stripW / dials : 0;
	const isSelected = (kind: "key" | "dial", index: number) => selected?.kind === kind && selected.index === index;

	return (
		<div className="deck-fit" ref={box}>
			<div className="deck-body" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
				<div className="deck-keys" style={{ gridTemplateColumns: `repeat(${columns}, ${KEY}px)`, gap: GAP }}>
					{state.keys.map((k) => (
						<button
							key={k.index}
							className={`deck-key${isSelected("key", k.index) ? " selected" : ""}`}
							style={{ width: KEY, height: KEY }}
							disabled={!onSelect}
							onClick={() => onSelect?.({ kind: "key", index: k.index })}
							aria-label={`Key ${k.index + 1}`}
						>
							<img src={svgUrl(k.svg)} alt="" draggable={false} />
						</button>
					))}
				</div>
				{dials > 0 && (
					<>
						<div className="deck-strip" style={{ width: stripW, height: STRIP_H, marginTop: GAP }}>
							{state.dials.map((d) => (
								<button
									key={d.index}
									className={`deck-segment${isSelected("dial", d.index) ? " selected" : ""}`}
									style={{ width: segment, height: STRIP_H }}
									disabled={!onSelect}
									onClick={() => onSelect?.({ kind: "dial", index: d.index })}
									aria-label={`Dial ${d.index + 1}`}
								>
									<img src={svgUrl(d.svg)} alt="" draggable={false} />
								</button>
							))}
						</div>
						<div className="deck-knobs" style={{ width: stripW }}>
							{state.dials.map((d) => (
								<button
									key={d.index}
									className={`deck-knob${isSelected("dial", d.index) ? " selected" : ""}`}
									style={{ width: KNOB, height: KNOB, marginLeft: (segment - KNOB) / 2, marginRight: (segment - KNOB) / 2 }}
									disabled={!onSelect}
									onClick={() => onSelect?.({ kind: "dial", index: d.index })}
									aria-label={`Dial ${d.index + 1} knob`}
								/>
							))}
						</div>
					</>
				)}
				{state.bar && (
					<div className="deck-neo" style={{ gridTemplateColumns: `repeat(${columns}, ${KEY}px)`, gap: GAP, marginTop: GAP }}>
						<span className="deck-touch" />
						<img
							className="deck-infobar"
							src={svgUrl(state.bar)}
							style={{ gridColumn: `span ${Math.max(1, columns - 2)}`, height: BAR_H }}
							alt=""
							draggable={false}
						/>
						<span className="deck-touch" />
					</div>
				)}
			</div>
		</div>
	);
}
