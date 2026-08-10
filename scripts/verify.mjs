#!/usr/bin/env node
// Pre-deploy check, one command: stop any running Next.js process (a
// concurrent dev server corrupts a `next build`'s .next/ cache), type-check,
// then a clean production build. Exits non-zero on the first failure so it
// can gate a commit/push without a human reading the output.
import { execSync, spawnSync } from "node:child_process";
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
    /* nothing was running */
  }
}

function run(label, cmd, args) {
  console.log(`\n[verify] ${label}...`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\n[verify] FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("[verify] stopping any running Next.js process...");
killStrayNext();

const nextDir = path.join(root, ".next");
if (existsSync(nextDir)) rmSync(nextDir, { recursive: true, force: true });

run("type-check", "npx", ["tsc", "--noEmit", "-p", "tsconfig.json"]);
run("production build", "npm", ["run", "build"]);

console.log("\n[verify] OK — type-check and build both passed.");
