/**
 * Self-update of the portable Windows app: a helper script waits for the app to close, unzips the
 * downloaded release over the app folder (files only added or replaced; settings live in
 * %APPDATA%), then starts the app again. It logs to update.log next to the settings.
 * Found on Windows: PowerShell started detached (no console) never runs the script, so the
 * helper is a plain child that starts its real work as a separate process.
 */
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Why this copy cannot update itself, or "" when it can (packaged on Windows, folder writable). */
export function cannotUpdate(packaged: boolean, exe: string): string {
	if (!packaged || process.platform !== "win32") return "Only the Windows app can update itself.";
	const probe = path.join(path.dirname(exe), `.dcs2streamdeck-write-test-${process.pid}`);
	try {
		writeFileSync(probe, "");
		rmSync(probe);
		return "";
	} catch {
		return `Cannot write to ${path.dirname(exe)}. Download the zip and unzip it to a folder you can write to.`;
	}
}

const HELPER = String.raw`# Stage 1 runs as the app's child (Windows ends those when the app quits): it starts stage 2 on its own and returns.
if ($env:D2S_UPDATE_STAGE -ne '2') {
	$env:D2S_UPDATE_STAGE = '2'
	Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Hidden -ArgumentList '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"')
	exit
}
$ErrorActionPreference = 'Stop'
$ProcessId = [int]$env:D2S_UPDATE_PID; $Zip = $env:D2S_UPDATE_ZIP; $Target = $env:D2S_UPDATE_TARGET; $Exe = $env:D2S_UPDATE_EXE; $Log = $env:D2S_UPDATE_LOG
function Say($text) { Add-Content -LiteralPath $Log -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $text) }
try {
	Say "update: waiting for $ProcessId to close"
	Wait-Process -Id $ProcessId -Timeout 60 -ErrorAction SilentlyContinue
	$until = (Get-Date).AddSeconds(60)
	while ((Get-Date) -lt $until -and @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Target + '\', 'OrdinalIgnoreCase') }).Count) { Start-Sleep -Milliseconds 500 }
	$stage = Join-Path (Split-Path -Parent $Zip) 'stage'
	if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
	New-Item -ItemType Directory -Path $stage | Out-Null
	& "$env:SystemRoot\System32\tar.exe" -xf $Zip -C $stage
	if ($LASTEXITCODE) { throw "unzip failed ($LASTEXITCODE)" }
	if (-not (Test-Path -LiteralPath (Join-Path $stage (Split-Path -Leaf $Exe)))) { throw 'the zip has no app' }
	& "$env:SystemRoot\System32\robocopy.exe" $stage $Target /E /R:10 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
	if ($LASTEXITCODE -ge 8) { throw "copy failed (robocopy $LASTEXITCODE)" }
	Say 'update: copied'
	Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
	Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
} catch {
	Say "update failed: $_"
}
foreach ($name in 'D2S_UPDATE_STAGE', 'D2S_UPDATE_PID', 'D2S_UPDATE_ZIP', 'D2S_UPDATE_TARGET', 'D2S_UPDATE_EXE', 'D2S_UPDATE_LOG') { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
Start-Process -FilePath $Exe
Say 'update: started the app'
`;

/**
 * Starts the helper for `zip` (downloaded into its own folder) and waits for its first stage, which
 * starts the second on its own (Windows ends the app's children when it quits); the caller then
 * quits so the helper can replace the app's files. Test-only variables are not passed on.
 */
export async function startZipUpdate(zip: string, exe: string, log: string): Promise<void> {
	const script = path.join(path.dirname(zip), "update.ps1");
	writeFileSync(script, HELPER);
	const env: NodeJS.ProcessEnv = {
		...process.env,
		D2S_UPDATE_PID: String(process.pid),
		D2S_UPDATE_ZIP: zip,
		D2S_UPDATE_TARGET: path.dirname(exe),
		D2S_UPDATE_EXE: exe,
		D2S_UPDATE_LOG: log,
	};
	delete env.D2S_INSTALL_UPDATE;
	delete env.D2S_UPDATE_STAGE;
	const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
	const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script];
	await new Promise<void>((resolve, reject) => {
		const child = spawn(powershell, args, { stdio: "ignore", windowsHide: true, env });
		const timer = setTimeout(() => reject(new Error("the update helper did not start")), 30000);
		child.once("error", reject);
		child.once("exit", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new Error(`the update helper stopped (${code})`));
		});
	});
}
