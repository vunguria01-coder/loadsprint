import fs from "fs";
import path from "path";
import crypto from "crypto";
import { encryptEldCredential, decryptEldCredential } from "@/lib/eld-connection-crypto";
import { withEldConnectionLock } from "@/lib/eld-connections-lock";
import { deleteEldSnapshotsForProvider } from "@/lib/eld-snapshots";
import { getEldAdapter, ELD_PROVIDERS, type EldAdapter, type EldCapabilities, type EldProvider } from "@/lib/eld-adapters";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CONN_FILE = path.join(DATA_DIR, "eld-connections.json");

// "credentials_saved", never "connected" — a saved credential and a
// VERIFIED credential are two different facts, tracked separately below.
// Same convention as lib/load-source-connections.ts.
export type EldConnectionStatus = "credentials_saved" | "disconnected";

// On disk, per owner and provider, only ciphertext plus lifecycle
// metadata — never the credential itself, and `verified`/`accountId`/
// `capabilities` are never accepted as API input; they're only ever
// written by verifyEldConnection() below, after it actually calls the
// adapter.
type StoredEldConnection = {
  status: EldConnectionStatus;
  nonceB64: string;
  ciphertextB64: string;
  schemaVersion: string;
  updatedAt: string;
  // Bumped on every saveEldConnection call, including replacing an
  // existing credential. verifiedRevision below has to match this exact
  // number for the connection to count as currently verified — swapping
  // in a new credential invalidates whatever the old one proved.
  revision: number;
  verified: boolean;
  verifiedRevision: number | null;
  verifiedAt: string | null;
  accountId: string | null;
  capabilities: EldCapabilities | null;
};
type Store = Record<string, Partial<Record<EldProvider, StoredEldConnection>>>;

// What an API route may safely return to the client — status/verification
// metadata only, never the ciphertext, and never the decrypted secret.
export type EldConnectionSummary = {
  provider: EldProvider;
  status: EldConnectionStatus;
  updatedAt: string | null;
  revision: number | null;
  verified: boolean;
  accountId: string | null;
  capabilities: EldCapabilities | null;
};

// The subset used for gating listDrivers()/refreshEldSnapshot() — same
// data as EldConnectionSummary, kept as a separate type so call sites that
// only need this don't accidentally depend on the API-response shape.
export type EldConnectionGate = {
  status: EldConnectionStatus;
  revision: number;
  verified: boolean;
  verifiedRevision: number | null;
  capabilities: EldCapabilities | null;
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONN_FILE)) fs.writeFileSync(CONN_FILE, "{}", "utf8");
}

function readAllSync(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(CONN_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

// write-to-temp-then-rename: a reader never observes a half-written file,
// and a crash mid-write leaves the old file intact instead of a truncated
// one. The cross-process lock (withEldConnectionLock) is what prevents two
// concurrent writers from racing each other's read-modify-write cycle —
// this only makes each individual write atomic.
function writeAllAtomicSync(s: Store) {
  ensure();
  const tmp = path.join(DATA_DIR, `.eld-connections.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), "utf8");
  fs.renameSync(tmp, CONN_FILE);
}

function toSummary(provider: EldProvider, c: StoredEldConnection | undefined): EldConnectionSummary {
  return {
    provider,
    status: c?.status === "credentials_saved" ? "credentials_saved" : "disconnected",
    updatedAt: c?.updatedAt ?? null,
    revision: c?.revision ?? null,
    verified: c?.verified ?? false,
    accountId: c?.accountId ?? null,
    capabilities: c?.capabilities ?? null,
  };
}

export function listEldConnections(ownerId: string): EldConnectionSummary[] {
  const owned = readAllSync()[ownerId] || {};
  return ELD_PROVIDERS.map((provider) => toSummary(provider, owned[provider]));
}

export type EldConnectionGateCheck = { ok: true } | { ok: false; code: string; message: string };

// Shared by lib/eld-driver-links.ts (before listDrivers()) and lib/eld-
// refresh.ts (before fetchSnapshot()) — the same three-part gate every
// outbound ELD call has to clear: a connection must exist, its
// verification must apply to the CURRENT credential revision (not a
// verification left over from a credential that's since been replaced),
// and it must have proven the specific capability this call needs. Any
// failure here means the caller never touches the network.
export function checkEldConnectionGate(
  gate: EldConnectionGate | null,
  requiredCapability: keyof EldCapabilities
): EldConnectionGateCheck {
  if (!gate || gate.status !== "credentials_saved") {
    return { ok: false, code: "connection_missing", message: "No saved connection for this provider." };
  }
  if (!gate.verified || gate.verifiedRevision !== gate.revision) {
    return { ok: false, code: "not_verified", message: "This connection hasn't been verified yet." };
  }
  if (!gate.capabilities || !gate.capabilities[requiredCapability]) {
    return {
      ok: false,
      code: "missing_capability",
      message: `This connection isn't authorized for ${requiredCapability}.`,
    };
  }
  return { ok: true };
}

// Everything lib/eld-driver-links.ts and lib/eld-refresh.ts need to decide
// whether they're allowed to call the adapter at all — deliberately not
// the same shape as EldConnectionSummary, so a future change to the public
// API response can't accidentally change what gates a network call.
export function getEldConnectionGate(ownerId: string, provider: EldProvider): EldConnectionGate | null {
  const c = readAllSync()[ownerId]?.[provider];
  if (!c) return null;
  return {
    status: c.status,
    revision: c.revision,
    verified: c.verified,
    verifiedRevision: c.verifiedRevision,
    capabilities: c.capabilities,
  };
}

// Encrypts `secret` under this owner+provider and stores only the
// ciphertext, under the cross-process lock so a concurrent save/delete for
// the same owner can't interleave with this read-modify-write. Bumps the
// revision and resets verification — a new secret has proven nothing yet,
// regardless of whether the old one was verified. (Callers that also need
// to purge old driver links/snapshots tied to the previous credential use
// lib/eld-connection-lifecycle.ts's saveEldConnectionAndReset, not this
// function directly — that stays out of this file to avoid a circular
// import with lib/eld-driver-links.ts.) Returns the safe summary — the
// plaintext secret is never returned, logged, or kept anywhere after this
// call unwinds.
export async function saveEldConnection(
  ownerId: string,
  provider: EldProvider,
  secret: string
): Promise<EldConnectionSummary> {
  const { nonceB64, ciphertextB64, schemaVersion } = encryptEldCredential(secret, ownerId, provider);
  return withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    if (!s[ownerId]) s[ownerId] = {};
    const existing = s[ownerId]![provider];
    const updatedAt = new Date().toISOString();
    const revision = (existing?.revision ?? 0) + 1;
    const record: StoredEldConnection = {
      status: "credentials_saved",
      nonceB64,
      ciphertextB64,
      schemaVersion,
      updatedAt,
      revision,
      verified: false,
      verifiedRevision: null,
      verifiedAt: null,
      accountId: null,
      capabilities: null,
    };
    s[ownerId]![provider] = record;
    writeAllAtomicSync(s);
    return toSummary(provider, record);
  });
}

// Removing the connection also removes every snapshot fetched through it
// for this owner, regardless of which driver it belonged to — without the
// connection there's no basis left for having pulled that data at all.
// (Driver-link cleanup lives in lib/eld-connection-lifecycle.ts for the
// same circular-import reason as saveEldConnectionAndReset above.)
export async function deleteEldConnection(ownerId: string, provider: EldProvider): Promise<void> {
  await withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    if (s[ownerId]?.[provider]) {
      delete s[ownerId]![provider];
      writeAllAtomicSync(s);
    }
  });
  await deleteEldSnapshotsForProvider(ownerId, provider);
}

// Internal use only (a future real ELD call) — decrypts and returns the
// live secret. No API route should ever forward this value back to a
// client; it exists for server-to-server calls to the provider. Throws
// (doesn't silently return null) if the ciphertext has been tampered with
// or the master key doesn't match — same behavior whether the cause is a
// flipped byte, a wrong nonce, or a stale schema version, so nothing here
// leaks which one it was.
export async function getDecryptedEldCredential(
  ownerId: string,
  provider: EldProvider
): Promise<string | null> {
  return withEldConnectionLock(ownerId, () => {
    const c = readAllSync()[ownerId]?.[provider];
    if (!c || c.status !== "credentials_saved") return null;
    return decryptEldCredential(c.nonceB64, c.ciphertextB64, ownerId, provider, c.schemaVersion);
  });
}

export type VerifyEldConnectionResult =
  | { ok: true; accountId: string; capabilities: EldCapabilities }
  | { ok: false; code: string; message: string };

// Proves a saved credential actually works. Decrypts it in memory only,
// calls the adapter (fail-closed if it isn't active — never a network call
// for a provider nobody's approved), and on success records `verified`
// pinned to the CURRENT revision — so if the credential is replaced later,
// this verification stops applying immediately (saveEldConnection already
// bumps the revision on every save; nothing here needs to "expire" it).
// A failed verification attempt never downgrades an already-verified
// revision; it just reports the failure.
export async function verifyEldConnection(
  ownerId: string,
  provider: EldProvider,
  adapterFor: (p: EldProvider) => EldAdapter = getEldAdapter,
  signal?: AbortSignal
): Promise<VerifyEldConnectionResult> {
  const gate = getEldConnectionGate(ownerId, provider);
  if (!gate || gate.status !== "credentials_saved") {
    return { ok: false, code: "connection_missing", message: "No saved connection for this provider." };
  }

  const adapter = adapterFor(provider);
  if (!adapter.active) {
    return { ok: false, code: "adapter_inactive", message: `${provider} adapter is not active.` };
  }

  let credential: string | null;
  try {
    credential = await getDecryptedEldCredential(ownerId, provider);
  } catch {
    return { ok: false, code: "credential_decrypt_failed", message: "Could not decrypt the saved connection." };
  }
  if (!credential) {
    return { ok: false, code: "connection_missing", message: "No saved connection for this provider." };
  }

  let verification;
  try {
    verification = await adapter.verifyConnection(credential, signal);
  } catch (e) {
    const code = e instanceof Error && e.name === "AbortError" ? "timeout" : "verify_failed";
    return { ok: false, code, message: "The provider rejected these credentials." };
  }

  await withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    const existing = s[ownerId]?.[provider];
    if (!existing || existing.revision !== gate.revision) {
      // The credential was replaced while this verification was in
      // flight — don't attach a stale verification to the new revision.
      return;
    }
    existing.verified = true;
    existing.verifiedRevision = existing.revision;
    existing.verifiedAt = new Date().toISOString();
    existing.accountId = verification.accountId;
    existing.capabilities = verification.capabilities;
    writeAllAtomicSync(s);
  });

  return { ok: true, accountId: verification.accountId, capabilities: verification.capabilities };
}
