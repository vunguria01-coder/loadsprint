#!/usr/bin/env node
// One command for the restart dance this project needs constantly during
// active development: `next dev` and `next build` corrupt each other's
// .next/ cache if they ever run at the same time (module-not-found errors
// on the next page load), so this kills any stray next process, wipes
// .next/, then starts a clean dev server. Safe to run any time — if
// nothing is running, the kill step is just a no-op.
import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function killStrayNext() {
  if (process.platform !== "win32") {
    try {
      execSync("pkill -f 'next (dev|build|start)'", { stdio: "ignore" });
    } catch {
      /* nothing was running */
    }
    return;
  }
  try {
    execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -match \'next\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { stdio: "ignore" }
    );
  } catch {
    /* nothing was running, or the shell call itself failed — either way, proceed */
  }
}

console.log("[dev-fresh] stopping any running Next.js process...");
killStrayNext();

const nextDir = path.join(root, ".next");
if (existsSync(nextDir)) {
  console.log("[dev-fresh] clearing .next/ ...");
  rmSync(nextDir, { recursive: true, force: true });
}

console.log("[dev-fresh] starting `next dev`...");
const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
