import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: "renderer",
	base: "./",
	plugins: [react()],
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				index: fileURLToPath(new URL("renderer/index.html", import.meta.url)),
				deck: fileURLToPath(new URL("renderer/deck.html", import.meta.url)),
			},
		},
	},
});
