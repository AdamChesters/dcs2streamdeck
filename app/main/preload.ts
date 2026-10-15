import { contextBridge, ipcRenderer } from "electron";

const on = (channel: string) => (listener: (payload: unknown) => void) => {
	const handler = (_e: unknown, payload: unknown) => listener(payload);
	ipcRenderer.on(channel, handler);
	return () => ipcRenderer.off(channel, handler);
};

contextBridge.exposeInMainWorld("d2s", {
	state: () => ipcRenderer.invoke("state"),
	controls: () => ipcRenderer.invoke("controls"),
	info: () => ipcRenderer.invoke("info"),
	keyDown: (index: number) => ipcRenderer.invoke("key-down", index),
	keyUp: (index: number) => ipcRenderer.invoke("key-up", index),
	dialRotate: (index: number, ticks: number) => ipcRenderer.invoke("dial-rotate", index, ticks),
	dialNext: (index: number) => ipcRenderer.invoke("dial-next", index),
	setKey: (index: number, settings: unknown) => ipcRenderer.invoke("set-key", index, settings),
	setDial: (index: number, settings: unknown) => ipcRenderer.invoke("set-dial", index, settings),
	setJsonDir: (dir: string) => ipcRenderer.invoke("set-json-dir", dir),
	device: (layout: unknown, name: string) => ipcRenderer.invoke("device", layout, name),
	deckWindow: (open: boolean) => ipcRenderer.invoke("deck-window", open),
	openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
	sendFeedback: (fields: unknown) => ipcRenderer.invoke("send-feedback", fields),
	updateStatus: () => ipcRenderer.invoke("update-status"),
	updateCheck: () => ipcRenderer.invoke("update-check"),
	onState: on("state"),
	onUpdateStatus: on("update-status"),
	onElgato: on("elgato"),
});
