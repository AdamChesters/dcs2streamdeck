// Property inspector link to Stream Deck (classic WebSocket protocol).
// Inputs with data-setting="name" save to the action; data-global="name" saves plugin-wide.
let socket;
let context;
let actionUuid;
let settings = {};
let globalSettings = {};
/** Controls from the plugin: { id, category, description, positions, maxValue, key, dial, led, lamp }. */
let catalog = [];
/** Dial presets for this aircraft: [name, knob list]. */
let presets = [];

window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, _info, actionInfo) => {
	context = uuid;
	const info = JSON.parse(actionInfo);
	actionUuid = info.action;
	settings = info.payload.settings || {};
	socket = new WebSocket(`ws://127.0.0.1:${port}`);
	socket.onopen = () => {
		send({ event: registerEvent, uuid });
		send({ event: "getGlobalSettings", context });
		send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "refresh" } });
		fill();
	};
	socket.onmessage = (msg) => {
		const m = JSON.parse(msg.data);
		if (m.event === "didReceiveSettings") {
			settings = m.payload.settings || {};
			fill();
		} else if (m.event === "didReceiveGlobalSettings") {
			globalSettings = m.payload.settings || {};
			fill();
		} else if (m.event === "sendToPropertyInspector" && m.payload.type === "data") {
			document.getElementById("status").textContent = m.payload.status;
			catalog = m.payload.catalog || [];
			presets = m.payload.presets || [];
			document.dispatchEvent(new Event("pi-catalog"));
		}
	};
};

function send(message) {
	if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function read(el) {
	if (el.type === "checkbox") return el.checked;
	if (el.type === "number") return el.value === "" ? undefined : Number(el.value);
	return el.value;
}

function write(el, value) {
	if (el.type === "checkbox") el.checked = Boolean(value);
	else if (document.activeElement !== el) el.value = value ?? "";
}

function fill() {
	for (const el of document.querySelectorAll("[data-setting]")) write(el, settings[el.dataset.setting]);
	for (const el of document.querySelectorAll("[data-global]")) write(el, globalSettings[el.dataset.global]);
	document.dispatchEvent(new Event("pi-filled"));
}

function saveSetting(name, value) {
	settings[name] = value;
	send({ event: "setSettings", context, payload: settings });
}

document.addEventListener("change", (ev) => {
	const el = ev.target;
	if (el.dataset.setting) saveSetting(el.dataset.setting, read(el));
	if (el.dataset.global) {
		globalSettings[el.dataset.global] = read(el);
		send({ event: "setGlobalSettings", context, payload: globalSettings });
		setTimeout(() => send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "refresh" } }), 500);
	}
});

/**
 * A dropdown of controls grouped by cockpit panel, with a search box that
 * narrows it. `keep(item)` limits which controls appear.
 */
function picker(select, search, keep) {
	const fill = () => {
		const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
		const current = settings[select.dataset.setting] ?? "";
		const groups = new Map();
		for (const item of catalog) {
			if (!keep(item)) continue;
			const text = `${item.id} ${item.description} ${item.category}`.toLowerCase();
			if (!words.every((w) => text.includes(w)) && item.id !== current) continue;
			if (!groups.has(item.category)) groups.set(item.category, []);
			groups.get(item.category).push(item);
		}
		const none = Object.assign(document.createElement("option"), { value: "", textContent: "(none)" });
		select.replaceChildren(
			none,
			...[...groups].map(([category, items]) => {
				const group = Object.assign(document.createElement("optgroup"), { label: category });
				group.append(...items.map((i) => Object.assign(document.createElement("option"), { value: i.id, textContent: `${i.description} (${i.id})` })));
				return group;
			}),
		);
		select.value = current;
		// While searching, show the matches as an open list (like live results).
		const matches = select.querySelectorAll("option").length - 1;
		select.size = words.length ? Math.max(2, Math.min(8, matches + 1 + groups.size)) : 1;
	};
	search.addEventListener("input", fill);
	search.addEventListener("keydown", (ev) => {
		if (ev.key !== "Enter") return;
		ev.preventDefault();
		const first = [...select.querySelectorAll("option")].find((o) => o.value);
		if (!first) return;
		select.value = first.value;
		select.dispatchEvent(new Event("change", { bubbles: true }));
	});
	// After a pick, close the results list.
	select.addEventListener("change", () => {
		search.value = "";
		setTimeout(fill, 0);
	});
	document.addEventListener("pi-catalog", fill);
	document.addEventListener("pi-filled", () => catalog.length && fill());
	return { refresh: fill, item: (id) => catalog.find((i) => i.id === id) };
}
