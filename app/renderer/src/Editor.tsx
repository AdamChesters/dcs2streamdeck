import { useEffect, useMemo, useState } from "react";

import { AIRCRAFT, DIAL_PRESETS as PRESETS } from "../../../core/aircraft.data.ts";
import type { DeckState, DialSettings, KeySettings, PickerItem } from "./api.ts";
import { api } from "./api.ts";
import type { Selection } from "./Deck.tsx";

export function Editor({ state, selection, onClose }: { state: DeckState; selection: Selection; onClose: () => void }) {
	const [items, setItems] = useState<PickerItem[]>([]);
	useEffect(() => {
		void api.controls().then(setItems);
	}, [state.status.controls, state.status.loaded.join()]);

	if (!selection) {
		return <aside className="editor empty">Click a key or dial to set it up.</aside>;
	}
	return (
		<aside className="editor">
			{selection.kind === "key" ? (
				<KeyEditor
					key={`k${selection.index}`}
					index={selection.index}
					items={items}
					initial={state.keys[selection.index]?.settings ?? {}}
					onClose={onClose}
				/>
			) : (
				<DialEditor
					key={`d${selection.index}`}
					index={selection.index}
					items={items}
					initial={state.dials[selection.index]?.settings ?? {}}
					onClose={onClose}
				/>
			)}
		</aside>
	);
}

/** A dropdown of controls grouped by cockpit panel, narrowed by a search box. */
function ControlPicker({
	items,
	value,
	onChange,
	keep,
	placeholder,
}: {
	items: PickerItem[];
	value: string;
	onChange: (id: string) => void;
	keep: (item: PickerItem) => boolean;
	placeholder: string;
}) {
	const [search, setSearch] = useState("");
	const groups = useMemo(() => {
		const words = search.toLowerCase().split(/\s+/).filter(Boolean);
		const map = new Map<string, PickerItem[]>();
		for (const item of items) {
			if (!keep(item)) continue;
			const text = `${item.id} ${item.description} ${item.category}`.toLowerCase();
			if (item.id !== value && !words.every((w) => text.includes(w))) continue;
			map.set(item.category, [...(map.get(item.category) ?? []), item]);
		}
		return [...map];
	}, [items, search, value, keep]);
	const matches = groups.reduce((n, [, list]) => n + list.length, 0);
	const pick = (id: string) => {
		onChange(id);
		setSearch("");
	};
	return (
		<div className="picker">
			<input
				type="search"
				placeholder={placeholder}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				onKeyDown={(e) => {
					// Enter picks the top match.
					const first = groups[0]?.[1][0];
					if (e.key === "Enter" && first) {
						e.preventDefault();
						pick(first.id);
					}
				}}
			/>
			{/* While searching, the matches show as an open list (live results). */}
			<select value={value} size={search.trim() ? Math.max(2, Math.min(8, matches + 1 + groups.length)) : 1} onChange={(e) => pick(e.target.value)}>
				<option value="">(none)</option>
				{groups.map(([category, list]) => (
					<optgroup key={category} label={category}>
						{list.map((i) => (
							<option key={i.id} value={i.id}>
								{i.description} ({i.id})
							</option>
						))}
					</optgroup>
				))}
			</select>
		</div>
	);
}

const forKeys = (i: PickerItem) => i.key;
const forLamps = (i: PickerItem) => i.led || i.key;
const forDials = (i: PickerItem) => i.dial;

function positionsOf(item: PickerItem | undefined): string[] {
	if (!item?.maxValue || item.maxValue < 2) return [];
	return item.positions ?? Array.from({ length: item.maxValue + 1 }, (_, i) => String(i));
}

function KeyEditor({ index, items, initial, onClose }: { index: number; items: PickerItem[]; initial: KeySettings; onClose: () => void }) {
	const [s, setS] = useState<KeySettings>(initial);
	const save = (next: KeySettings) => {
		setS(next);
		void api.setKey(index, next);
	};
	const text = (name: "title" | "press" | "release") => ({
		value: s[name] ?? "",
		onChange: (e: { target: { value: string } }) => setS({ ...s, [name]: e.target.value }),
		onBlur: () => save(s),
	});
	const item = items.find((i) => i.id === s.control);
	const positions = positionsOf(item);
	const chosen = new Set(s.cycle ?? []);

	// Picking a switch fills in its own light when it has one and none is set.
	const pickControl = (id: string) => {
		const picked = items.find((i) => i.id === id);
		save({ ...s, control: id, cycle: [], lamp: s.lamp || picked?.lamp || "" });
	};

	return (
		<>
			<header>
				<h2>Key {index + 1}</h2>
				<button className="ghost" onClick={onClose} aria-label="Close editor">
					Done
				</button>
			</header>
			<label>
				Control
				<ControlPicker items={items} value={s.control ?? ""} onChange={pickControl} keep={forKeys} placeholder="Type to search (e.g. apu), then pick below" />
			</label>
			<label>
				Key text
				<input placeholder="Empty = control name" {...text("title")} />
			</label>
			<label>
				Press does
				<select value={s.mode ?? ""} onChange={(e) => save({ ...s, mode: e.target.value as KeySettings["mode"] })}>
					<option value="">Automatic</option>
					<option value="toggle">Toggle</option>
					<option value="cycle">Next position (wraps)</option>
					<option value="momentary">Hold (press 1, release 0)</option>
					<option value="inc">Step up</option>
					<option value="dec">Step down</option>
					<option value="custom">Custom command</option>
				</select>
			</label>
			{positions.length > 0 && (!s.mode || s.mode === "cycle") && (
				<div className="field">
					<span>Positions a press steps through</span>
					<div className="checks">
						{positions.map((name, i) => (
							<label key={name} className="check">
								<input
									type="checkbox"
									checked={chosen.has(i)}
									onChange={(e) => {
										const next = new Set(chosen);
										if (e.target.checked) next.add(i);
										else next.delete(i);
										save({ ...s, cycle: [...next].sort((a, b) => a - b) });
									}}
								/>
								{name}
							</label>
						))}
					</div>
					<p className="hint">Untick spring-loaded positions (e.g. EMERG EXTD). None ticked = all.</p>
				</div>
			)}
			{s.mode === "custom" && (
				<div className="row2">
					<label>
						On press
						<input placeholder="e.g. 2, TOGGLE, INC" {...text("press")} />
					</label>
					<label>
						On release
						<input placeholder="optional" {...text("release")} />
					</label>
				</div>
			)}
			<label>
				Light the key from
				<ControlPicker items={items} value={s.lamp ?? ""} onChange={(id) => save({ ...s, lamp: id })} keep={forLamps} placeholder="Type to search (e.g. caution, l bar, aoa)" />
			</label>
			<label className="check">
				<input type="checkbox" checked={Boolean(s.invert)} onChange={(e) => save({ ...s, invert: e.target.checked })} />
				Light when OFF
			</label>
			<p className="hint">
				Matches appear in the list as you type; click one, or press Enter for the top match. The text shows the switch; the
				highlight shows the light, in its cockpit colour. A light with several colours or parts (AOA indexer) shows all of
				them. For a light-only key (e.g. a caution light), leave Control as
				(none). Held and magnetic switches stay lit while on and go dark when the jet releases them.
			</p>
			<footer>
				<button onMouseDown={() => void api.keyDown(index)} onMouseUp={() => void api.keyUp(index)} onMouseLeave={() => void api.keyUp(index)}>
					Test press
				</button>
				<button className="ghost" onClick={() => save({})}>
					Clear key
				</button>
			</footer>
		</>
	);
}

function DialEditor({ index, items, initial, onClose }: { index: number; items: PickerItem[]; initial: DialSettings; onClose: () => void }) {
	const [text, setText] = useState(initial.functions ?? "");
	const [adding, setAdding] = useState("");
	const save = (functions: string) => {
		setText(functions);
		void api.setDial(index, { functions });
	};
	const label = (id: string) =>
		id
			.replace(/_(CTL|SW|KNOB|DIMMER|CONTROL)$/, "")
			.replace(/_/g, " ")
			.slice(0, 14)
			.trim();
	return (
		<>
			<header>
				<h2>Dial {index + 1}</h2>
				<button className="ghost" onClick={onClose} aria-label="Close editor">
					Done
				</button>
			</header>
			<label>
				{AIRCRAFT.name} presets
				<select value="" onChange={(e) => e.target.value && save(e.target.value)}>
					<option value="">Choose a preset…</option>
					{PRESETS.map(([name, value]) => (
						<option key={name} value={value}>
							{name}
						</option>
					))}
				</select>
			</label>
			<label>
				Add a knob
				<ControlPicker items={items} value={adding} onChange={setAdding} keep={forDials} placeholder="Type to search (e.g. dimmer), then pick below" />
			</label>
			<footer>
				<button disabled={!adding} onClick={() => save(`${text.trim()}\n${adding} | ${label(adding)}`.trim())}>
					Add
				</button>
			</footer>
			<label>
				Knobs (press the dial to step through them)
				<textarea
					rows={7}
					spellCheck={false}
					placeholder="CONTROL_ID | Label | step"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onBlur={() => save(text)}
				/>
			</label>
			<p className="hint">
				One knob per line: <code>CONTROL_ID | Label | step</code>. Label and step are optional. Step is per dial click for 0–65535
				knobs (DCS-BIOS default 3200).
			</p>
			<footer>
				<button onClick={() => void api.dialRotate(index, -1)} aria-label="Turn left">
					◀ Turn
				</button>
				<button onClick={() => void api.dialRotate(index, 1)} aria-label="Turn right">
					Turn ▶
				</button>
				<button onClick={() => void api.dialNext(index)}>Next knob</button>
				<button className="ghost" onClick={() => save("")}>
					Clear dial
				</button>
			</footer>
		</>
	);
}
