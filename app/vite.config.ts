import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

// Aircraft to build for: AIRCRAFT=f16c (default fa18c), see "#aircraft" in the root package.json.
const aircraft = process.env.AIRCRAFT ?? "fa18c";

export default defineConfig({
	root: "renderer",
	resolve: { conditions: [aircraft, ...defaultClientConditions] },
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
