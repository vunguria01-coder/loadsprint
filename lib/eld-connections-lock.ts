import fs from "fs";
import path from "path";

// Short, blocking, cross-process mutual exclusion for one owner's ELD
// connection record — same design as lib/load-cache-lock.ts (atomic
// exclusive-create via `wx`, stale-lock takeover, no heartbeat since
// nothing held under this lock ever does network I/O), kept as its own
// module rather than sharing state with the load-source cache lock: these
// two credential stores are deliberately independent of each other.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const LOCK_DIR = path.join(DATA_DIR, "eld-connections-locks");

const STALE_MS = 5_000;
const POLL_MS = 15;
const ACQUIRE_TIMEOUT_MS = 5_000;

function ensureDir() {
  if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
}

function lockPath(ownerId: string): string {
  return path.join(LOCK_DIR, `${encodeURIComponent(ownerId)}.lock`);
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

export async function withEldConnectionLock<T>(ownerId: string, fn: () => T | Promise<T>): Promise<T> {
  ensureDir();
  const p = lockPath(ownerId);
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
      continue;
    }
    if (Date.now() > deadline) throw new Error("eld_connection_lock_timeout");
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
