import { useEffect, useMemo, useState } from "react";

import type { AircraftData } from "../../../core/aircraft.data.ts";
import { AIRCRAFT_LIST, aircraftById, aircraftOf } from "../../../core/aircraft.data.ts";
import type { DeckState, DialSettings, KeySettings, PickerItem } from "./api.ts";
import { api } from "./api.ts";
import type { Selection } from "./Deck.tsx";

export function Editor({ state, selection, onClose }: { state: DeckState; selection: Selection; onClose: () => void }) {
	const flying = state.status.flying ? aircraftById(state.status.flying) : undefined;
	// Changes when the control files are (re)loaded.
	const version = `${state.status.controls} ${state.status.loaded.join()}`;
	if (!selection) {
		return <aside className="editor empty">Click a key or dial to set it up.</aside>;
	}
	return (
		<aside className="editor">
			{selection.kind === "key" ? (
				<KeyEditor
					key={`k${selection.index}`}
					index={selection.index}
					flying={flying}
					version={version}
					initial={state.keys[selection.index]?.settings ?? {}}
					onClose={onClose}
				/>
			) : (
				<DialEditor
					key={`d${selection.index}`}
					index={selection.index}
					flying={flying}
					version={version}
					initial={state.dials[selection.index]?.settings ?? {}}
					onClose={onClose}
				/>
			)}
		</aside>
	);
}

/** One aircraft's controls for the pickers. */
function useItems(aircraft: string, version: string): PickerItem[] {
	const [items, setItems] = useState<PickerItem[]>([]);
	useEffect(() => {
		void api.controls(aircraft).then(setItems);
	}, [aircraft, version]);
	return items;
}

/** The key's or dial's aircraft. A different aircraft has different controls, so changing it starts the key again. */
function AircraftPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
	return (
		<>
			<label>
				Aircraft
				<select value={value} onChange={(e) => e.target.value !== value && onChange(e.target.value)}>
					{AIRCRAFT_LIST.map(({ AIRCRAFT }) => (
						<option key={AIRCRAFT.id} value={AIRCRAFT.id}>
							{AIRCRAFT.fullName}
						</option>
					))}
				</select>
			</label>
			<p className="hint">New keys start on the aircraft DCS is flying. Keys for another aircraft go dark until DCS flies it. AH-64D: a control both seats have follows the seat you are in.</p>
		</>
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
	const picked = items.find((i) => i.id === value);
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
			{/* While searching, the matches show as an open list (live results). Long names wrap there and show in full below. */}
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
			{picked && (
				<p className="picked">
					{picked.description} <code>{picked.id}</code>
				</p>
			)}
		</div>
	);
}

const forKeys = (i: PickerItem) => i.key;
const forLamps = (i: PickerItem) => !i.action && (i.led || i.key);
const forDials = (i: PickerItem) => i.dial;

/** [value, name] pairs from the top (or left) of the switch, like the cockpit. */
/** The list entry for a key: its bind ("PTT/RTS Switch - ICS") when it is one, else its control. */
function pickedId(items: PickerItem[], control: string | undefined, mode: string | undefined): string {
	if (!control) return "";
	return items.find((i) => i.action?.control === control && i.action.mode === mode)?.id ?? control;
}

/** Positions "Next position" can land on, top (or left) first, like the cockpit. */
function positionsOf(item: PickerItem | undefined): [number, string][] {
	if (!item?.maxValue || item.maxValue < 2) return [];
	return (item.cycle ?? []).map((v) => [v, item.positions?.[v] ?? String(v)]);
}

/** "Press does": what this control can do. A saved choice it can't do any more stays listed. */
function modesOf(item: PickerItem | undefined, current: string): [string, string][] {
	const modes = item?.modes ?? [];
	const auto = modes.find((m) => m.value === item?.auto);
	const options: [string, string][] = [["", auto ? `Automatic (${auto.label})` : "Automatic"], ...modes.map((m): [string, string] => [m.value, m.label])];
	if (current && current !== "custom" && !options.some(([v]) => v === current)) options.push([current, current]);
	options.push(["custom", "Custom command"]);
	return options;
}

type EditorProps<T> = { index: number; flying?: AircraftData; version: string; initial: T; onClose: () => void };

function KeyEditor({ index, flying, version, initial, onClose }: EditorProps<KeySettings>) {
	const [s, setS] = useState<KeySettings>(initial);
	const aircraft = aircraftOf(s, flying).AIRCRAFT.id;
	const items = useItems(aircraft, version);
	// The first save keeps the aircraft shown (a new key's default can change with what DCS flies).
	const save = (next: KeySettings) => {
		const pinned = { ...next, aircraft: next.aircraft ?? aircraft };
		setS(pinned);
		void api.setKey(index, pinned);
	};
	const text = (name: "title" | "press" | "release") => ({
		value: s[name] ?? "",
		onChange: (e: { target: { value: string } }) => setS({ ...s, [name]: e.target.value }),
		onBlur: () => save(s),
	});
	const item = items.find((i) => i.id === s.control);
	const positions = positionsOf(item);
	const chosen = new Set(s.cycle ?? []);
	// The list shows the key's bind ("PTT/RTS Switch - ICS") when it is one, else its control.
	const shown = pickedId(items, s.control, s.mode);

	// Picking a bind sets its control and mode; picking a control starts on Automatic (a mode for the
	// old control may mean nothing). A switch fills in its own light when it has one and none is set.
	const pickControl = (id: string) => {
		const picked = items.find((i) => i.id === id);
		const control = picked?.action?.control ?? id;
		const mode = picked?.action?.mode ?? (s.mode === "custom" ? s.mode : "");
		save({ ...s, control, mode: mode as KeySettings["mode"], cycle: [], lamp: s.lamp || picked?.lamp || "" });
	};

	return (
		<>
			<header>
				<h2>Key {index + 1}</h2>
				<button className="ghost" onClick={onClose} aria-label="Close editor">
					Done
				</button>
			</header>
			<AircraftPicker value={aircraft} onChange={(id) => save({ aircraft: id, ...(s.title ? { title: s.title } : {}) })} />
			<label>
				Control
				<ControlPicker items={items} value={shown} onChange={pickControl} keep={forKeys} placeholder="Type to search (e.g. apu), then pick below" />
			</label>
			<label>
				Key text
				<input placeholder="Empty = control name" {...text("title")} />
			</label>
			<label>
				Press does
				<select value={s.mode ?? ""} onChange={(e) => save({ ...s, mode: e.target.value as KeySettings["mode"] })}>
					{modesOf(item, s.mode ?? "").map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</label>
			<p className="hint">Hold: the switch springs back when you let go. Set: it stays. Turn: a short press is a small step; hold to turn faster.</p>
			{positions.length > 1 && (s.mode === "cycle" || (!s.mode && item?.auto === "cycle")) && (
				<div className="field">
					<span>Positions a press steps through</span>
					<div className="checks">
						{positions.map(([value, name]) => (
							<label key={value} className="check">
								<input
									type="checkbox"
									checked={chosen.has(value)}
									onChange={(e) => {
										const next = new Set(chosen);
										if (e.target.checked) next.add(value);
										else next.delete(value);
										save({ ...s, cycle: [...next].sort((a, b) => a - b) });
									}}
								/>
								{name}
							</label>
						))}
					</div>
					<p className="hint">Untick any you don't want a press to land on. None ticked = all listed.</p>
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
				(none). Held and magnetic switches stay lit while on and go dark when the aircraft releases them.
			</p>
			<footer>
				<button onMouseDown={() => void api.keyDown(index)} onMouseUp={() => void api.keyUp(index)} onMouseLeave={() => void api.keyUp(index)}>
					Test press
				</button>
				<button className="ghost" onClick={() => save({ aircraft })}>
					Clear key
				</button>
			</footer>
		</>
	);
}

function DialEditor({ index, flying, version, initial, onClose }: EditorProps<DialSettings>) {
	const [text, setText] = useState(initial.functions ?? "");
	const [pinned, setPinned] = useState(initial.aircraft);
	const [adding, setAdding] = useState("");
	const aircraft = aircraftOf({ aircraft: pinned, functions: text }, flying);
	const items = useItems(aircraft.AIRCRAFT.id, version);
	const save = (functions: string, id = aircraft.AIRCRAFT.id) => {
		setText(functions);
		setPinned(id);
		void api.setDial(index, { aircraft: id, functions });
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
			<AircraftPicker value={aircraft.AIRCRAFT.id} onChange={(id) => save("", id)} />
			<label>
				{aircraft.AIRCRAFT.name} presets
				<select value="" onChange={(e) => e.target.value && save(e.target.value)}>
					<option value="">Choose a preset…</option>
					{aircraft.DIAL_PRESETS.map(([name, value]) => (
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
