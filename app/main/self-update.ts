/**
 * Self-update of the portable Windows app: a helper script waits for the app to close, unzips the
 * downloaded release over the app folder (files only added or replaced; settings live in
 * %APPDATA%), then starts the app again. It logs to update.log next to the settings.
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

const HELPER = String.raw`param([int]$ProcessId, [string]$Zip, [string]$Target, [string]$Exe, [string]$Log)
$ErrorActionPreference = 'Stop'
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
Start-Process -FilePath $Exe
Say 'update: started the app'
`;

/**
 * Starts the helper for `zip` (downloaded into its own folder) and returns; the caller quits the
 * app so the helper can replace its files. Test-only variables are not passed on to the new app.
 */
export async function startZipUpdate(zip: string, exe: string, log: string): Promise<void> {
	const script = path.join(path.dirname(zip), "update.ps1");
	writeFileSync(script, HELPER);
	const env = { ...process.env };
	delete env.D2S_INSTALL_UPDATE;
	const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script];
	args.push("-ProcessId", String(process.pid), "-Zip", zip, "-Target", path.dirname(exe), "-Exe", exe, "-Log", log);
	const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
	await new Promise<void>((resolve, reject) => {
		const child = spawn(powershell, args, { detached: true, stdio: "ignore", windowsHide: true, env });
		child.once("error", reject);
		child.once("spawn", () => {
			child.unref();
			resolve();
		});
	});
}
