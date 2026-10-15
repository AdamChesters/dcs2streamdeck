// Bundles the Electron main process and preload (shared core included).
import { build } from "esbuild";

const common = { bundle: true, platform: "node", format: "cjs", target: "node22", external: ["electron"], logLevel: "info" };
await build({ ...common, entryPoints: ["main/main.ts"], outfile: "dist-electron/main.cjs" });
await build({ ...common, entryPoints: ["main/preload.ts"], outfile: "dist-electron/preload.cjs" });
