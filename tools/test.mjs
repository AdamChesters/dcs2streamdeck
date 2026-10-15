// Runs the shared tests, then each aircraft's tests with that aircraft's data selected
// (the "#aircraft" import condition, also passed to the processes the tests start).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const runs = [["shared", "test/*.test.ts"], ...readdirSync("aircraft").map((id) => [id, `aircraft/${id}/test/*.test.ts`])];
let failed = 0;
for (const [id, files] of runs) {
	console.log(`\n# ${id}`);
	const options = id === "shared" ? "" : `--conditions=${id}`;
	const env = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, options].filter(Boolean).join(" ") };
	if (spawnSync(process.execPath, ["--test", files], { stdio: "inherit", env }).status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
