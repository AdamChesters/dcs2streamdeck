/**
 * dcs2streamdeck standalone app, one build per aircraft: Electron main process.
 * The Stream Deck itself is driven from the main window's renderer (WebHID);
 * this process owns DCS-BIOS, settings, updates and the windows.
 */
import { execFile, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";

import { app, BrowserWindow, ipcMain, Menu, session, shell } from "electron";

import { AIRCRAFT } from "../../core/aircraft.data.ts";
import type { DialSettings, KeySettings } from "../../core/bindings.ts";
import type { DeckConfig, Layout } from "./engine.ts";
import { Engine } from "./engine.ts";
import { RELEASES_PAGE, Updater } from "./updates.ts";
// Shared support component (feedback relay sender).
import feedback from "../donate/feedback.cjs";

const APP_ID = AIRCRAFT.appId;
const TITLE = `dcs2streamdeck ${AIRCRAFT.name}`;
const ELGATO_VENDOR_ID = 0x0fd9;

type AppConfig = DeckConfig & { deckWindow?: { open: boolean; bounds?: Electron.Rectangle } };

// Each aircraft's app keeps its own settings (set before the single-instance lock, which lives there).
app.setPath("userData", path.join(app.getPath("appData"), APP_ID));
if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId(AIRCRAFT.uuid);

const configPath = () => path.join(app.getPath("userData"), "config.json");

function loadConfig(): AppConfig {
	try {
		const config = JSON.parse(readFileSync(configPath(), "utf8")) as AppConfig;
		return { ...config, keys: config.keys ?? {}, dials: config.dials ?? {} };
	} catch {
		return { keys: {}, dials: {} };
	}
}

function saveConfig(config: AppConfig): void {
	mkdirSync(path.dirname(configPath()), { recursive: true });
	const temp = `${configPath()}.tmp`;
	writeFileSync(temp, JSON.stringify(config, null, 2));
	renameSync(temp, configPath());
}

let config: AppConfig;
let engine: Engine;
let updater: Updater;
let mainWindow: BrowserWindow | undefined;
let deckWindow: BrowserWindow | undefined;
let elgatoRunning = false;

const page = (name: string) => path.join(__dirname, "..", "dist", name);
const preload = path.join(__dirname, "preload.cjs");

function broadcast(channel: string, payload: unknown): void {
	for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload);
}

function createMainWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 680,
		minWidth: 640,
		minHeight: 480,
		title: TITLE,
		backgroundColor: "#26282b",
		webPreferences: { preload, contextIsolation: true, backgroundThrottling: false },
	});
	mainWindow.on("page-title-updated", (e) => e.preventDefault());
	void mainWindow.loadFile(page("index.html"));
	mainWindow.on("closed", () => {
		mainWindow = undefined;
		app.quit();
	});
}

/** Frameless window with only the deck, for OpenKneeboard window capture. */
function createDeckWindow(): void {
	if (deckWindow) {
		deckWindow.show();
		return;
	}
	const bounds = config.deckWindow?.bounds;
	deckWindow = new BrowserWindow({
		width: bounds?.width ?? 480,
		height: bounds?.height ?? 394,
		x: bounds?.x,
		y: bounds?.y,
		minWidth: 260,
		minHeight: 165,
		frame: false,
		title: `${TITLE} Deck`,
		backgroundColor: "#2b2d31",
		webPreferences: { preload, contextIsolation: true, backgroundThrottling: false },
	});
	deckWindow.on("page-title-updated", (e) => e.preventDefault());
	void deckWindow.loadFile(page("deck.html"));
	const remember = () => {
		if (!deckWindow) return;
		config.deckWindow = { open: true, bounds: deckWindow.getBounds() };
		saveConfig(config);
	};
	deckWindow.on("moved", remember);
	deckWindow.on("resized", remember);
	deckWindow.on("closed", () => {
		deckWindow = undefined;
		if (!quitting) {
			config.deckWindow = { ...config.deckWindow, open: false };
			saveConfig(config);
		}
	});
	config.deckWindow = { ...config.deckWindow, open: true };
	saveConfig(config);
}

let quitting = false;
app.on("before-quit", () => {
	quitting = true;
});

/** WebHID: allow Elgato decks without a browser-style chooser. */
function allowStreamDecks(): void {
	const ses = session.defaultSession;
	ses.setPermissionCheckHandler((_wc, permission) => permission === "hid");
	ses.setDevicePermissionHandler((details) => details.deviceType === "hid" && details.device.vendorId === ELGATO_VENDOR_ID);
	ses.on("select-hid-device", (event, details, callback) => {
		event.preventDefault();
		callback(details.deviceList.find((d) => d.vendorId === ELGATO_VENDOR_ID)?.deviceId ?? "");
	});
}

/** The Elgato app holds the deck while it runs; warn the user to close it. */
function watchElgatoApp(): void {
	if (process.platform !== "win32") return;
	const check = () =>
		execFile("tasklist", ["/FI", "IMAGENAME eq StreamDeck.exe", "/NH"], { windowsHide: true }, (_err, out) => {
			const running = /StreamDeck\.exe/i.test(out ?? "");
			if (running !== elgatoRunning) {
				elgatoRunning = running;
				broadcast("elgato", running);
			}
		});
	check();
	setInterval(check, 15000);
}

function registerIpc(): void {
	ipcMain.handle("state", () => engine.state());
	ipcMain.handle("controls", () => engine.controlsList());
	ipcMain.handle("info", () => ({
		version: app.getVersion(),
		appId: APP_ID,
		releasesPage: RELEASES_PAGE,
		elgatoRunning,
		deckWindowOpen: Boolean(deckWindow),
	}));
	ipcMain.handle("key-down", (_e, index: number) => engine.keyDown(index));
	ipcMain.handle("key-up", (_e, index: number) => engine.keyUp(index));
	ipcMain.handle("dial-rotate", (_e, index: number, ticks: number) => engine.dialRotate(index, ticks));
	ipcMain.handle("dial-next", (_e, index: number) => engine.dialNext(index));
	ipcMain.handle("set-key", (_e, index: number, settings: KeySettings) => engine.setKey(index, settings));
	ipcMain.handle("set-dial", (_e, index: number, settings: DialSettings) => engine.setDial(index, settings));
	ipcMain.handle("set-json-dir", (_e, dir: string) => engine.setJsonDir(dir));
	ipcMain.handle("device", (_e, layout: Layout | null, name: string) => engine.setDevice(layout, name));
	ipcMain.handle("deck-window", (_e, open: boolean) => {
		if (open) createDeckWindow();
		else deckWindow?.close();
	});
	ipcMain.handle("open-external", (_e, url: string) => {
		if (!/^https:\/\//.test(url)) throw new Error("Only https links open.");
		return shell.openExternal(url);
	});
	ipcMain.handle("send-feedback", (_e, fields: { name: string; email: string; message: string }) =>
		feedback.sendFeedback(fields, app.getVersion(), APP_ID),
	);
	ipcMain.handle("update-status", () => updater.status);
	ipcMain.handle("update-check", () => updater.check());
	ipcMain.handle("update-download", () => updater.download());
	ipcMain.handle("update-cancel", () => updater.cancel());
	ipcMain.handle("update-install", () => {
		const installer = updater.status.state === "ready" ? updater.status.installer : undefined;
		if (!installer) return false;
		spawn(installer, [], { detached: true, stdio: "ignore", windowsHide: false }).unref();
		setTimeout(() => app.quit(), 300);
		return true;
	});
}

app.whenReady().then(() => {
	Menu.setApplicationMenu(null);
	config = loadConfig();
	engine = new Engine(
		config,
		(state) => broadcast("state", state),
		() => saveConfig(config),
	);
	updater = new Updater({
		currentVersion: app.getVersion(),
		downloadDir: path.join(app.getPath("userData"), "updates"),
		onStatus: (status) => broadcast("update-status", status),
	});
	allowStreamDecks();
	registerIpc();
	createMainWindow();
	if (config.deckWindow?.open) createDeckWindow();
	engine.start();
	watchElgatoApp();
	void updater.check();
	if (process.env.D2S_CAPTURE) captureForChecks(process.env.D2S_CAPTURE);
});

// Test hook: D2S_CAPTURE=<folder> saves a PNG of each window, then quits.
function captureForChecks(dir: string): void {
	setTimeout(async () => {
		if (process.env.D2S_CAPTURE_CLICK) {
			await mainWindow?.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(process.env.D2S_CAPTURE_CLICK)})?.click()`);
			await new Promise((r) => setTimeout(r, 600));
		}
		mkdirSync(dir, { recursive: true });
		if (mainWindow) writeFileSync(path.join(dir, "main.png"), (await mainWindow.webContents.capturePage()).toPNG());
		if (deckWindow) writeFileSync(path.join(dir, "deck.png"), (await deckWindow.webContents.capturePage()).toPNG());
		app.quit();
	}, Number(process.env.D2S_CAPTURE_DELAY ?? 3000));
}

app.on("second-instance", () => {
	if (mainWindow?.isMinimized()) mainWindow.restore();
	mainWindow?.focus();
});

app.on("will-quit", () => engine?.stop());
