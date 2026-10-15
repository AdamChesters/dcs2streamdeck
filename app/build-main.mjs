// Bundles the Electron main process and preload (shared core included).
import { build } from "esbuild";

// Aircraft to build for: AIRCRAFT=f16c (default fa18c), see "#aircraft" in the root package.json.
const conditions = [process.env.AIRCRAFT ?? "fa18c"];
const common = { bundle: true, platform: "node", format: "cjs", target: "node22", external: ["electron"], conditions, logLevel: "info" };
await build({ ...common, entryPoints: ["main/main.ts"], outfile: "dist-electron/main.cjs" });
await build({ ...common, entryPoints: ["main/preload.ts"], outfile: "dist-electron/preload.cjs" });
