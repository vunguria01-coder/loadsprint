import fs from "fs";
import path from "path";

/**
 * Crash-safe helpers for the local JSON stores.
 *
 * The naive `writeFileSync(file, JSON.stringify(...))` truncates the file
 * before it writes the new bytes, so any request that reads during that window
 * sees invalid JSON. Callers that swallow the parse error and fall back to an
 * empty list then write that empty list back — which is how duplicate seed rows
 * and lost accounts appear. Writing to a sibling temp file and renaming makes
 * the swap atomic: a reader sees either the old file or the new one.
 */
export function writeJsonAtomic(file: string, data: unknown) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Same directory, so the rename stays on one filesystem (and is atomic).
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* temp file already gone */
    }
    throw err;
  }
}

/**
 * Read a JSON file, retrying briefly on a torn read.
 *
 * Returns `fallback` only when the file is genuinely absent or empty. A file
 * that exists with content but will not parse is a real problem, so it throws
 * rather than quietly reporting "no data" — quietly is what destroys records.
 */
export function readJson<T>(file: string, fallback: T, retries = 3): T {
  for (let attempt = 0; ; attempt++) {
    if (!fs.existsSync(file)) return fallback;
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      if (attempt >= retries) throw new Error(`Cannot read ${file}`);
      continue;
    }
    if (raw.trim() === "") return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      // Most likely a concurrent write mid-flight; give it a moment to land.
      if (attempt >= retries) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);
    }
  }
}
