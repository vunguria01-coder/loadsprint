import fs from "fs";
import path from "path";
import { encryptSecret, decryptSecret } from "@/lib/load-source-crypto";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CONN_FILE = path.join(DATA_DIR, "load-source-connections.json");

export const LOAD_SOURCE_PROVIDERS = [
  "dat",
  "123loadboard",
  "truckstop",
  "uber_freight",
] as const;
export type LoadSourceProvider = (typeof LOAD_SOURCE_PROVIDERS)[number];

// "credentials_saved", never "connected" — no adapter makes a real API call
// yet (see lib/load-source-adapters/), so nothing here has actually been
// verified against the provider. Only promote to a real "connected" once an
// adapter is contractually approved and its API check succeeds.
export type LoadSourceStatus = "credentials_saved" | "disconnected";

// On disk, per owner (company) and provider, only ciphertext — never the
// credential itself. status/updatedAt are metadata, safe to read as-is.
type StoredConnection = {
  status: LoadSourceStatus;
  nonceB64: string;
  ciphertextB64: string;
  updatedAt: string;
};
type Store = Record<string, Partial<Record<LoadSourceProvider, StoredConnection>>>;

// What an API route may safely return to the client — status only, never
// the ciphertext, and never the decrypted secret.
export type LoadSourceConnectionSummary = {
  provider: LoadSourceProvider;
  status: LoadSourceStatus;
  updatedAt: string | null;
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONN_FILE)) fs.writeFileSync(CONN_FILE, "{}", "utf8");
}

function readAll(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(CONN_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  ensure();
  fs.writeFileSync(CONN_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function listConnections(ownerId: string): LoadSourceConnectionSummary[] {
  const owned = readAll()[ownerId] || {};
  return LOAD_SOURCE_PROVIDERS.map((provider) => {
    const c = owned[provider];
    return {
      provider,
      status: c?.status === "credentials_saved" ? "credentials_saved" : "disconnected",
      updatedAt: c?.updatedAt ?? null,
    };
  });
}

// Every owner id with at least one credentials_saved connection — for a
// coordinator (lib/load-ingest-job.ts) that has to walk every owner rather
// than being handed one. Status/updatedAt only, same as listConnections();
// never the ciphertext or secret.
export function listOwnersWithSavedConnections(): { ownerId: string; connections: LoadSourceConnectionSummary[] }[] {
  const all = readAll();
  const out: { ownerId: string; connections: LoadSourceConnectionSummary[] }[] = [];
  for (const ownerId of Object.keys(all)) {
    const connections = listConnections(ownerId).filter((c) => c.status === "credentials_saved");
    if (connections.length > 0) out.push({ ownerId, connections });
  }
  return out;
}

// Encrypts `secret` under this owner+provider and stores only the
// ciphertext. Returns the safe summary — the plaintext secret is never
// returned, logged, or kept anywhere after this call unwinds.
export function saveConnection(
  ownerId: string,
  provider: LoadSourceProvider,
  secret: string
): LoadSourceConnectionSummary {
  const { nonceB64, ciphertextB64 } = encryptSecret(secret, ownerId, provider);
  const s = readAll();
  if (!s[ownerId]) s[ownerId] = {};
  const updatedAt = new Date().toISOString();
  s[ownerId]![provider] = { status: "credentials_saved", nonceB64, ciphertextB64, updatedAt };
  writeAll(s);
  return { provider, status: "credentials_saved", updatedAt };
}

export function deleteConnection(ownerId: string, provider: LoadSourceProvider): void {
  const s = readAll();
  if (s[ownerId]?.[provider]) {
    delete s[ownerId]![provider];
    writeAll(s);
  }
}

// Internal use only (a future real load-search call) — decrypts and
// returns the live secret. No API route should ever forward this value
// back to a client; it exists for server-to-server calls to the provider.
export function getDecryptedSecret(
  ownerId: string,
  provider: LoadSourceProvider
): string | null {
  const c = readAll()[ownerId]?.[provider];
  if (!c || c.status !== "credentials_saved") return null;
  return decryptSecret(c.nonceB64, c.ciphertextB64, ownerId, provider);
}
