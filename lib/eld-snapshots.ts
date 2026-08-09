import fs from "fs";
import path from "path";
import crypto from "crypto";
import { encryptEldData, decryptEldData } from "@/lib/eld-data-crypto";
import { withEldConnectionLock } from "@/lib/eld-connections-lock";
import type { EldProvider, NormalizedEldSnapshot } from "@/lib/eld-adapters";

// Latest-only ELD snapshot storage — no history, one record per owner+
// driver, overwritten on every successful refresh. Deliberately a leaf
// module (no dependency on lib/eld-driver-links.ts or lib/eld-connections.
// ts) so those two can both depend on it — for their unlink/delete cleanup
// hooks — without a circular import; the actual fetch orchestration
// (lib/eld-refresh.ts) is what ties this together with the link and
// connection stores.
//
// The *Sync functions below are lock-naive on purpose (same convention as
// lib/load-cache.ts's upsertBatch/purgeLoadCache): they assume the caller
// already holds withEldConnectionLock(ownerId). lib/eld-refresh.ts needs
// this to close a real race — a slow fetchSnapshot() call can still be in
// flight when credentials are replaced, the driver is unlinked, or the
// connection is deleted; the write it eventually wants to do has to be
// re-validated and performed inside ONE lock acquisition, not two, so
// nothing can happen in between. The public async wrappers (still exported
// for any caller that isn't already inside that lock) just acquire the
// lock and call the sync version once.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "eld-snapshots.json");

// On disk: ciphertext plus only the metadata needed to schedule/display a
// refresh — never the decrypted HOS/location content, never a raw API
// response, never a full error message (just a short code).
type StoredEldSnapshotRecord = {
  provider: EldProvider;
  externalDriverId: string;
  nonceB64: string | null;
  ciphertextB64: string | null;
  schemaVersion: string | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
};

type Store = Record<string, Record<string, StoredEldSnapshotRecord>>;

export type EldSnapshotStatus = {
  provider: EldProvider;
  externalDriverId: string;
  hasSnapshot: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SNAPSHOTS_FILE)) fs.writeFileSync(SNAPSHOTS_FILE, "{}", "utf8");
}

function readAllSync(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAllAtomicSync(s: Store) {
  ensure();
  const tmp = path.join(DATA_DIR, `.eld-snapshots.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), "utf8");
  fs.renameSync(tmp, SNAPSHOTS_FILE);
}

function keyFor(driverEmail: string): string {
  return driverEmail.trim().toLowerCase();
}

function getEldSnapshotStatusSync(ownerId: string, driverEmail: string): EldSnapshotStatus | null {
  const rec = readAllSync()[ownerId]?.[keyFor(driverEmail)];
  if (!rec) return null;
  return {
    provider: rec.provider,
    externalDriverId: rec.externalDriverId,
    hasSnapshot: rec.ciphertextB64 != null,
    lastSuccessAt: rec.lastSuccessAt,
    lastAttemptAt: rec.lastAttemptAt,
    lastErrorCode: rec.lastErrorCode,
  };
}

// Reads are synchronized through the same lock as writes — a read can't
// land between a stale response being discarded and its (non-)write, or
// between a delete and the file actually reflecting it.
export function getEldSnapshotStatus(ownerId: string, driverEmail: string): Promise<EldSnapshotStatus | null> {
  return withEldConnectionLock(ownerId, () => getEldSnapshotStatusSync(ownerId, driverEmail));
}

function getDecryptedEldSnapshotSync(ownerId: string, driverEmail: string): NormalizedEldSnapshot | null {
  const key = keyFor(driverEmail);
  const rec = readAllSync()[ownerId]?.[key];
  if (!rec || !rec.nonceB64 || !rec.ciphertextB64 || !rec.schemaVersion) return null;
  const json = decryptEldData(rec.nonceB64, rec.ciphertextB64, ownerId, key, rec.provider, rec.externalDriverId, rec.schemaVersion);
  return JSON.parse(json) as NormalizedEldSnapshot;
}

// Internal use only — never returned by an API route. Throws (doesn't
// silently return null or garbage) if the ciphertext has been tampered
// with, same as every other decrypt path in this codebase.
export function getDecryptedEldSnapshot(ownerId: string, driverEmail: string): Promise<NormalizedEldSnapshot | null> {
  return withEldConnectionLock(ownerId, () => getDecryptedEldSnapshotSync(ownerId, driverEmail));
}

// Lock-naive — caller must already hold withEldConnectionLock(ownerId).
// Overwrites whatever was stored; this is the only history kept, the
// latest one. lastErrorCode is cleared: a fresh success means the failing
// streak, if any, is over.
export function recordEldSnapshotSuccessSync(
  ownerId: string,
  driverEmail: string,
  provider: EldProvider,
  externalDriverId: string,
  encrypted: { nonceB64: string; ciphertextB64: string; schemaVersion: string }
): void {
  const key = keyFor(driverEmail);
  const s = readAllSync();
  if (!s[ownerId]) s[ownerId] = {};
  const now = new Date().toISOString();
  s[ownerId][key] = {
    provider,
    externalDriverId,
    nonceB64: encrypted.nonceB64,
    ciphertextB64: encrypted.ciphertextB64,
    schemaVersion: encrypted.schemaVersion,
    lastSuccessAt: now,
    lastAttemptAt: now,
    lastErrorCode: null,
  };
  writeAllAtomicSync(s);
}

export async function recordEldSnapshotSuccess(
  ownerId: string,
  driverEmail: string,
  provider: EldProvider,
  externalDriverId: string,
  snapshot: NormalizedEldSnapshot
): Promise<void> {
  const key = keyFor(driverEmail);
  const encrypted = encryptEldData(JSON.stringify(snapshot), ownerId, key, provider, externalDriverId);
  await withEldConnectionLock(ownerId, () =>
    recordEldSnapshotSuccessSync(ownerId, driverEmail, provider, externalDriverId, encrypted)
  );
}

// Lock-naive — caller must already hold withEldConnectionLock(ownerId). A
// failed refresh NEVER touches the previous good ciphertext — only the
// attempt/error metadata moves. A dispatcher looking at a driver's card
// after a failed poll still sees the last known-good HOS data, honestly
// labeled with when the last successful sync was and that the most recent
// attempt didn't work.
export function recordEldSnapshotFailureSync(
  ownerId: string,
  driverEmail: string,
  provider: EldProvider,
  externalDriverId: string,
  errorCode: string
): void {
  const key = keyFor(driverEmail);
  const s = readAllSync();
  if (!s[ownerId]) s[ownerId] = {};
  const existing = s[ownerId][key];
  const now = new Date().toISOString();
  s[ownerId][key] = {
    provider,
    externalDriverId,
    nonceB64: existing?.nonceB64 ?? null,
    ciphertextB64: existing?.ciphertextB64 ?? null,
    schemaVersion: existing?.schemaVersion ?? null,
    lastSuccessAt: existing?.lastSuccessAt ?? null,
    lastAttemptAt: now,
    lastErrorCode: errorCode,
  };
  writeAllAtomicSync(s);
}

export async function recordEldSnapshotFailure(
  ownerId: string,
  driverEmail: string,
  provider: EldProvider,
  externalDriverId: string,
  errorCode: string
): Promise<void> {
  await withEldConnectionLock(ownerId, () =>
    recordEldSnapshotFailureSync(ownerId, driverEmail, provider, externalDriverId, errorCode)
  );
}

// Called when a driver's ELD link is removed (lib/eld-driver-links.ts) —
// their snapshot has no reason to exist without the link that authorized
// fetching it.
export async function deleteEldSnapshotsForDriver(ownerId: string, driverEmail: string): Promise<void> {
  const key = keyFor(driverEmail);
  await withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    if (s[ownerId]?.[key]) {
      delete s[ownerId][key];
      writeAllAtomicSync(s);
    }
  });
}

// Called when an ELD connection is deleted (lib/eld-connections.ts) —
// every driver's snapshot fetched through that provider for this owner
// loses its basis too, regardless of which driver it belonged to.
export async function deleteEldSnapshotsForProvider(ownerId: string, provider: EldProvider): Promise<void> {
  await withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    const owned = s[ownerId];
    if (!owned) return;
    let changed = false;
    for (const [email, rec] of Object.entries(owned)) {
      if (rec.provider === provider) {
        delete owned[email];
        changed = true;
      }
    }
    if (changed) writeAllAtomicSync(s);
  });
}
