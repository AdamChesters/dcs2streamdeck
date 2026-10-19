import { useEffect, useMemo, useRef, useState } from "react";

// Shared support component (about / support / feedback / updates).
import SupportDialog from "../../donate/SupportDialog.jsx";
import type { DeckState, Info, UpdateStatus } from "./api.ts";
import { api } from "./api.ts";
import type { Selection } from "./Deck.tsx";
import { Deck } from "./Deck.tsx";
import { aircraftById } from "../../../core/aircraft.data.ts";
import { Editor } from "./Editor.tsx";
import { DeckLink } from "./hid.ts";
import logo from "./logo.svg";

const APP_NAME = "dcs2streamdeck";

export function App() {
	const [state, setState] = useState<DeckState>();
	const [info, setInfo] = useState<Info>();
	const [update, setUpdate] = useState<UpdateStatus>();
	const [deckName, setDeckName] = useState("");
	const [elgato, setElgato] = useState(false);
	const [selection, setSelection] = useState<Selection>(null);
	const [dialog, setDialog] = useState<"" | "support" | "update" | "settings">("");
	const [deckWindow, setDeckWindow] = useState(false);
	const link = useRef<DeckLink>(undefined);

	useEffect(() => {
		link.current = new DeckLink(setDeckName);
		void api.state().then(setState);
		void api.info().then((i) => {
			setInfo(i);
			setElgato(i.elgatoRunning);
			setDeckWindow(i.deckWindowOpen);
		});
		void api.updateStatus().then(setUpdate);
		void link.current.autoConnect();
		const stops = [api.onState(setState), api.onUpdateStatus(setUpdate), api.onElgato(setElgato)];
		return () => stops.forEach((stop) => stop());
	}, []);

	useEffect(() => {
		if (state) link.current?.draw(state);
	}, [state]);

	if (!state || !info) return null;

	const toggleDeckWindow = () => {
		void api.deckWindow(!deckWindow);
		setDeckWindow(!deckWindow);
	};

	return (
		<div className="app">
			<header className="topbar">
				<img className="topbar-logo" src={logo} alt="" />
				<span className="topbar-name">{APP_NAME}</span>
				<Status on={state.status.dcs} label={state.status.dcs ? `DCS · ${flyingName(state)}` : "DCS"} />
				<Status on={Boolean(deckName)} label={deckName || "No Stream Deck"} />
				<span className="spacer" />
				<button className={`bar-button${deckWindow ? " active" : ""}`} onClick={toggleDeckWindow} title="Deck-only window for OpenKneeboard">
					Deck window
				</button>
				<button className="bar-button" onClick={() => setDialog("settings")}>
					Settings
				</button>
				<button className="bar-button" onClick={() => setDialog("support")}>
					Feedback / Support
				</button>
				<VersionLight info={info} update={update} onClick={() => setDialog("update")} />
			</header>

			{elgato && (
				<div className="banner">
					The Elgato Stream Deck app is running. Close it so {APP_NAME} can use your Stream Deck.
				</div>
			)}

			<main className="workspace">
				<section className="deck-area">
					<Deck state={state} selected={selection} onSelect={setSelection} />
				</section>
				<Editor state={state} selection={selection} onClose={() => setSelection(null)} />
			</main>

			{dialog === "support" && (
				<SupportDialog
					onClose={() => setDialog("")}
					appName={APP_NAME}
					appLogo={logo}
					appId={info.appId}
					appVersion={info.version}
					updateStatus={updateText(update)}
					updateBusy={update?.state === "checking" || update?.state === "downloading" || update?.state === "installing"}
					updateAvailable={update?.state === "available" ? update.release?.version : ""}
					checkForUpdates={() => {
						if (update?.state === "available") setDialog("update");
						else void api.updateCheck();
					}}
					openExternal={api.openExternal}
					sendFeedback={api.sendFeedback}
				/>
			)}
			{dialog === "update" && update && <UpdateDialog info={info} update={update} onClose={() => setDialog("")} />}
			{dialog === "settings" && (
				<SettingsDialog state={state} deckName={deckName} link={link.current} onClose={() => setDialog("")} />
			)}
		</div>
	);
}

/** What DCS flies, by its short name when supported (e.g. "F/A-18C"). */
function flyingName(state: DeckState): string {
	if (state.status.flying) return aircraftById(state.status.flying).AIRCRAFT.name;
	return state.status.aircraft ? `${state.status.aircraft} (not supported)` : "no aircraft";
}

function Status({ on, label }: { on: boolean; label: string }) {
	return (
		<span className="status">
			<i className={on ? "dot on" : "dot"} />
			{label}
		</span>
	);
}

function VersionLight({ info, update, onClick }: { info: Info; update?: UpdateStatus; onClick: () => void }) {
	const state = update?.state;
	const cls = state === "current" || state === "installing" ? "on" : state === "available" || state === "downloading" ? "update" : "";
	return (
		<button className="bar-button version" onClick={onClick} title={updateText(update)}>
			<i className={`dot ${cls}`} />v{info.version}
		</button>
	);
}

function updateText(update?: UpdateStatus): string {
	switch (update?.state) {
		case "checking":
			return "Checking for updates…";
		case "current":
			return "Up to date.";
		case "available":
			return update.message || `Version ${update.release?.version} is available.`;
		case "downloading":
			return `Downloading ${update.release?.version}… ${Math.round((update.progress ?? 0) * 100)}%`;
		case "installing":
			return update.message || `Installing ${update.release?.version}…`;
		case "failed":
			return update.message || "Could not check for updates.";
		default:
			return "";
	}
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		ref.current?.showModal();
	}, []);
	return (
		<dialog ref={ref} className="modal" onCancel={onClose}>
			<header>
				<h2>{title}</h2>
				<button className="ghost" onClick={onClose}>
					Close
				</button>
			</header>
			{children}
		</dialog>
	);
}

function UpdateDialog({ info, update, onClose }: { info: Info; update: UpdateStatus; onClose: () => void }) {
	const release = update.release;
	const [error, setError] = useState("");
	const install = () => {
		setError("");
		api.updateInstall().catch((e: Error) => setError(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "")));
	};
	return (
		<Modal title="Updates" onClose={onClose}>
			<p>
				This version: <strong>v{info.version}</strong>
				{release && (
					<>
						{" "}
						· Latest on GitHub: <strong>v{release.version}</strong>
					</>
				)}
			</p>
			<p className="muted">{error || updateText(update)}</p>
			{update.state === "downloading" && <progress className="update-progress" value={update.progress ?? 0} max={1} />}
			{update.state === "available" && (
				<p>
					{info.selfUpdate
						? `${info.selfUpdate} Close ${APP_NAME} and unzip the new zip over this folder (or into a new one).`
						: `Install downloads the new version from GitHub, closes ${APP_NAME}, puts it in this folder and starts it again.`}{" "}
					Your keys and dials are kept: they are saved in your Windows profile, not in the app folder.
				</p>
			)}
			{release?.notes && <pre className="notes">{release.notes}</pre>}
			<footer>
				{update.state === "available" && release && !info.selfUpdate && (
					<button className="primary" onClick={install}>
						Install {release.version} and restart
					</button>
				)}
				{update.state === "available" && release && (
					<button className={info.selfUpdate ? "primary" : ""} onClick={() => void api.openExternal(release.fileUrl)}>
						Download {release.fileName}
					</button>
				)}
				{(update.state === "current" || update.state === "available" || update.state === "failed") && (
					<button onClick={() => void api.updateCheck()}>Check again</button>
				)}
				<button className="ghost" onClick={() => void api.openExternal(release?.page ?? info.releasesPage)}>
					Open releases
				</button>
			</footer>
		</Modal>
	);
}

function SettingsDialog({ state, deckName, link, onClose }: { state: DeckState; deckName: string; link?: DeckLink; onClose: () => void }) {
	const [dir, setDir] = useState(state.status.jsonDir);
	const status = state.status;
	const loaded = useMemo(() => status.loaded.join(" + "), [status.loaded]);
	return (
		<Modal title="Settings" onClose={onClose}>
			<label>
				DCS-BIOS JSON folder
				<input value={dir} spellCheck={false} onChange={(e) => setDir(e.target.value)} onBlur={() => void api.setJsonDir(dir)} />
			</label>
			<p className="muted">{status.error || `${status.controls} controls from ${loaded}.`}</p>
			<p className="muted">
				{status.dcs ? `DCS is sending data (${status.aircraft || "no aircraft"}).` : "DCS is not sending data. Start a mission with DCS-BIOS installed."}
			</p>
			<h3>Stream Deck</h3>
			<p className="muted">{deckName ? `Connected: ${deckName}.` : "No Stream Deck connected. Close the Elgato Stream Deck app, then connect."}</p>
			{state.bar && (
				<p className="muted">
					Experimental: the info bar shows DCS and the time; nothing can be put on it yet. Tell us how it works on your Neo with Feedback / Support.
				</p>
			)}
			<footer>
				<button onClick={() => void link?.request()}>Connect Stream Deck</button>
			</footer>
			<h3>VR</h3>
			<p className="muted">
				Open the deck window from the top bar, then add it in OpenKneeboard as a Window Capture tab named “{APP_NAME} Deck”. Keep the deck
				window open (it can sit behind DCS).
			</p>
		</Modal>
	);
}
