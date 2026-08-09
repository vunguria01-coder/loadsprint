import fs from "fs";
import path from "path";

// Short, blocking, cross-process mutual exclusion — NOT a lease like
// lib/load-ingest-lock.ts. Nothing that holds this lock ever does network
// I/O (that happens before acquiring it), so there's no need for a
// heartbeat; a holder is only ever inside it for the time it takes to do a
// few fs reads/writes. This closes the policy↔ingestion race: an in-flight
// ingest re-reads the policy under this same lock right before it writes,
// and an admin's policy change (+ cache purge/scrub) holds the same lock
// for its entire write, so the two can never interleave.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const LOCK_DIR = path.join(DATA_DIR, "load-cache-locks");

// Anything inside the lock is fs-only and fast — a lock file older than
// this can only mean its holder crashed before reaching `finally`, so the
// next acquirer safely clears it instead of waiting forever.
const STALE_MS = 5_000;
const POLL_MS = 15;
const ACQUIRE_TIMEOUT_MS = 5_000;

function ensureDir() {
  if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
}

function lockPath(key: string): string {
  return path.join(LOCK_DIR, `${encodeURIComponent(key)}.lock`);
}

function tryAcquire(p: string): boolean {
  try {
    fs.writeFileSync(p, String(process.pid), { flag: "wx" });
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw e;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function policyLockKey(provider: string): string {
  return `policy:${provider}`;
}

// Runs `fn` with `key` exclusively held, blocking (with polling + stale
// takeover) rather than failing fast — callers here are readers/writers
// that must wait their brief turn, not job runners that should skip when
// busy.
export async function withCacheLock<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
  ensureDir();
  const p = lockPath(key);
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  for (;;) {
    if (tryAcquire(p)) break;
    try {
      const st = fs.statSync(p);
      if (Date.now() - st.mtimeMs > STALE_MS) {
        fs.unlinkSync(p);
        continue;
      }
    } catch {
      continue; // lock vanished between the failed acquire and this stat — retry immediately
    }
    if (Date.now() > deadline) throw new Error("load_cache_lock_timeout");
    await sleep(POLL_MS);
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(p);
    } catch {
      /* already gone */
    }
  }
}
