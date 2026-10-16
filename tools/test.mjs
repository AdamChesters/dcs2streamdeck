// Runs the shared tests, then each aircraft's tests, one group at a time (the end-to-end
// tests use the real DCS-BIOS ports, so two groups must not run at once).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const runs = [["shared", "test/*.test.ts"], ...readdirSync("aircraft").map((id) => [id, `aircraft/${id}/test/*.test.ts`])];
let failed = 0;
for (const [id, files] of runs) {
	console.log(`\n# ${id}`);
	if (spawnSync(process.execPath, ["--test", files], { stdio: "inherit" }).status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
