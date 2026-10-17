// Property inspector link to Stream Deck (classic WebSocket protocol).
// Inputs with data-setting="name" save to the action; data-global="name" saves plugin-wide.
let socket;
let context;
let actionUuid;
let settings = {};
let globalSettings = {};
/** Controls of this key's aircraft: { id, category, description, positions, maxValue, key, dial, led, lamp }. */
let catalog = [];
/** Dial presets for this key's aircraft: [name, knob list]. */
let presets = [];
/** This key's aircraft ID, as the plugin chose it. */
let aircraft = "";
let releasesPage = "";
/** This plugin's version ("0.4.2"), shown in the update row. */
let version = "__VERSION__".split(".").slice(0, 3).join(".");

// Every page starts with Setup (always open, with the update row) and the key's aircraft.
const header = document.createElement("div");
header.innerHTML = `
	<div class="setup">
		<div class="setup-title">Setup (all keys and dials)</div>
		<div id="update" class="update"><b></b><span></span></div>
		<div class="status" id="status">Waiting for plugin…</div>
		<label for="jsonDir">DCS-BIOS JSON folder</label>
		<input type="text" id="jsonDir" data-global="jsonDir" placeholder="Empty = Saved Games\\DCS\\Scripts\\DCS-BIOS\\doc\\json" />
		<label for="mirrorPort">VR mirror port</label>
		<input type="number" id="mirrorPort" data-global="mirrorPort" placeholder="__MIRROR_PORT__" />
		<div class="hint">VR mirror page: <code>http://127.0.0.1:__MIRROR_PORT__/</code> (or your port), for an OpenKneeboard Web Dashboard tab. A new port needs a Stream Deck restart.</div>
	</div>
	<label for="aircraft">Aircraft</label>
	<select id="aircraft"></select>
	<div class="hint">New keys start on the jet DCS is flying. Each key keeps its own jet; the lists below show only its controls. Keys for another jet go dark until DCS flies it.</div>`;
document.body.prepend(...header.children);

// The update row always shows this version: green tick when it is the newest release, red
// cross when a newer one is out, amber "!" when GitHub could not be asked.
const UPDATE = {
	checking: ["", "", () => "Checking for updates…"],
	current: ["ok", "✓", () => "Up to date"],
	available: ["bad", "✕", (latest) => (latest ? `Update available: ${latest}` : "Update available")],
	failed: ["warn", "!", () => "Could not check for updates"],
};

function showUpdate(state, latest = "", message = "") {
	const [cls, mark, text] = UPDATE[state] ?? UPDATE.failed;
	const row = document.getElementById("update");
	row.className = `update ${cls}`;
	row.querySelector("b").textContent = mark;
	row.querySelector("span").textContent = `${version ? `Version ${version} · ` : ""}${text(latest)}`;
	row.title = state === "available" ? "Open the releases page" : state === "failed" ? `${message || "Could not check for updates"}. Click for the releases page.` : "";
}
showUpdate("checking");

document.getElementById("update").addEventListener("click", () => {
	const row = document.getElementById("update");
	if ((row.classList.contains("bad") || row.classList.contains("warn")) && releasesPage) send({ event: "openUrl", payload: { url: releasesPage } });
});

function refresh() {
	send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "refresh", settings } });
}

// A different jet has different controls: the key starts again (its text stays).
document.getElementById("aircraft").addEventListener("change", (ev) => {
	const id = ev.target.value;
	if (!id || id === aircraft) return;
	settings = { aircraft: id, ...(settings.title ? { title: settings.title } : {}) };
	aircraft = id;
	send({ event: "setSettings", context, payload: settings });
	fill();
	refresh();
});

window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, _info, actionInfo) => {
	context = uuid;
	const info = JSON.parse(actionInfo);
	actionUuid = info.action;
	settings = info.payload.settings || {};
	socket = new WebSocket(`ws://127.0.0.1:${port}`);
	socket.onopen = () => {
		send({ event: registerEvent, uuid });
		send({ event: "getGlobalSettings", context });
		refresh();
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
			const data = m.payload;
			document.getElementById("status").textContent = data.status;
			version = data.version || version;
			showUpdate(data.update, data.latest, data.updateMessage);
			releasesPage = data.releasesPage || "";
			aircraft = data.aircraft;
			const select = document.getElementById("aircraft");
			select.replaceChildren(...(data.aircraftList || []).map((a) => Object.assign(document.createElement("option"), { value: a.id, textContent: a.name })));
			select.value = aircraft;
			// A new key keeps the jet the plugin chose for it.
			if (!settings.aircraft && aircraft) saveSetting("aircraft", aircraft);
			catalog = data.catalog || [];
			presets = data.presets || [];
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
		setTimeout(refresh, 500);
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
