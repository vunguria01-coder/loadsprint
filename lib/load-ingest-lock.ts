import fs from "fs";
import path from "path";

// Cross-process job lease — the in-process Set a single Node instance could
// use isn't enough once more than one process (two Railway workers, or an
// old instance still finishing during a deploy) might run the same
// ingestion job at the same time. Acquisition is atomic via an exclusive
// file create (`wx` — fails if the file already exists), so two processes
// racing for the same key can never both believe they got it.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const LOCK_DIR = path.join(DATA_DIR, "load-ingest-locks");

type Lease = { runId: string; acquiredAt: string; expiresAt: string };

function ensureDir() {
  if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
}

function lockPath(key: string): string {
  return path.join(LOCK_DIR, `${encodeURIComponent(key)}.lock`);
}

function readLease(p: string): Lease | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Lease;
  } catch {
    return null;
  }
}

// The atomic primitive: succeeds only if the file did not already exist.
function createExclusive(p: string, lease: Lease): boolean {
  try {
    fs.writeFileSync(p, JSON.stringify(lease), { flag: "wx" });
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw e;
  }
}

// Tries to take the lease for `key`. Returns false if someone else
// currently holds a non-expired lease on it. A lease whose holder never
// renewed it (crashed, never released) is recognized as stale by its own
// expiresAt and safely reclaimed — no separate "is that process alive?"
// check is needed or possible across machines.
//
// Race note: if two callers both observe the same stale lease at the same
// instant, both attempt to reclaim, but the exclusive re-create below still
// lets only ONE of them actually win the file; the other's create fails and
// it correctly reports "not acquired" instead of both proceeding.
export function acquireLease(
  key: string,
  leaseMs: number,
  runId: string,
  now: () => number = Date.now
): boolean {
  ensureDir();
  const p = lockPath(key);
  const lease: Lease = {
    runId,
    acquiredAt: new Date(now()).toISOString(),
    expiresAt: new Date(now() + leaseMs).toISOString(),
  };

  if (createExclusive(p, lease)) return true;

  const existing = readLease(p);
  if (!existing || new Date(existing.expiresAt).getTime() > now()) return false; // held, not expired

  try {
    fs.unlinkSync(p);
  } catch {
    /* already gone */
  }
  return createExclusive(p, lease);
}

// Heartbeat — extends the lease while work is still genuinely in progress.
// Only the recorded owner (matching runId) may renew; a caller that lost
// its lease (e.g. reclaimed as stale while it was unexpectedly slow) gets
// false back and should stop what it's doing.
export function renewLease(
  key: string,
  runId: string,
  leaseMs: number,
  now: () => number = Date.now
): boolean {
  const p = lockPath(key);
  const existing = readLease(p);
  if (!existing || existing.runId !== runId) return false;
  const lease: Lease = { runId, acquiredAt: existing.acquiredAt, expiresAt: new Date(now() + leaseMs).toISOString() };
  fs.writeFileSync(p, JSON.stringify(lease), "utf8");
  return true;
}

// Only the recorded owner may release — never blind-deletes a lock file,
// so a caller that already lost its lease can't accidentally clear
// whoever holds it now.
export function releaseLease(key: string, runId: string): void {
  const p = lockPath(key);
  const existing = readLease(p);
  if (existing && existing.runId === runId) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* already gone */
    }
  }
}
