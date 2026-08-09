import fs from "fs";
import path from "path";
import type { NormalizedLoad } from "@/lib/load-source-adapters";
import type { LoadSourceProvider } from "@/lib/load-source-connections";
import type { LoadProviderPolicy } from "@/lib/load-provider-policy";
import { getProviderPolicy } from "@/lib/load-provider-policy";
import { withCacheLock, policyLockKey } from "@/lib/load-cache-lock";

// Local, provider-neutral cache of search results so a search reads
// LoadSprint's own data instead of hitting a provider on every click. Only
// the normalized shape is ever stored — never the provider's raw API
// response — and nothing here merges loads across providers "by
// similarity": identity is strictly ownerId + provider + externalId.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "load-cache.json");

// What a live (non-deleted, non-expired) cache read returns to a caller.
export type CachedLoad = NormalizedLoad & {
  ownerId: string;
  fetchedAt: string;
  expiresAt: string;
};

// What's actually on disk. `load` is null once deleteLoad() tombstones an
// entry — a deleted record keeps only enough to identify the slot, never
// the load's actual content (origin/destination/rate/broker/etc).
type StoredEntry = {
  ownerId: string;
  provider: LoadSourceProvider;
  externalId: string;
  fetchedAt: string;
  expiresAt: string;
  deleted: boolean;
  load: NormalizedLoad | null;
};

type Store = Record<string, StoredEntry>;

function cacheKey(ownerId: string, provider: LoadSourceProvider, externalId: string): string {
  return `${ownerId}|${provider}|${externalId}`;
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, "{}", "utf8");
}

function readAll(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  ensure();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(s, null, 2), "utf8");
}

// Upserts exactly the loads passed in — updates an existing entry in place
// (same ownerId+provider+externalId key, no duplicate), and never touches
// any other cached entry. Call this once per fetched page/batch; omitting a
// previously-cached load from `loads` does NOT remove it.
export function upsertBatch(
  ownerId: string,
  provider: LoadSourceProvider,
  loads: NormalizedLoad[],
  ttlMs: number
): void {
  if (!ownerId || loads.length === 0) return;
  const s = readAll();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  for (const load of loads) {
    if (load.provider !== provider) continue; // defense: a batch can't write into another provider's slot
    const k = cacheKey(ownerId, provider, load.externalId);
    s[k] = {
      ownerId,
      provider,
      externalId: load.externalId,
      fetchedAt: now.toISOString(),
      expiresAt,
      deleted: false,
      load,
    };
  }
  writeAll(s);
}

// Explicit tombstone — for when a provider tells us a specific load is
// gone (booked, pulled, etc.), as opposed to it merely being missing from
// the next batch. Strips the load's content immediately; only identity and
// timestamps remain.
export function deleteLoad(ownerId: string, provider: LoadSourceProvider, externalId: string): void {
  const s = readAll();
  const k = cacheKey(ownerId, provider, externalId);
  const existing = s[k];
  if (existing) {
    s[k] = { ...existing, deleted: true, load: null };
    writeAll(s);
  }
}

function readValidSync(ownerId: string, provider: LoadSourceProvider): CachedLoad[] {
  const s = readAll();
  const now = Date.now();
  const out: CachedLoad[] = [];
  for (const e of Object.values(s)) {
    if (e.deleted || !e.load) continue;
    if (e.ownerId !== ownerId) continue;
    if (e.provider !== provider) continue;
    if (new Date(e.expiresAt).getTime() <= now) continue;
    out.push({ ...e.load, ownerId: e.ownerId, fetchedAt: e.fetchedAt, expiresAt: e.expiresAt });
  }
  return out;
}

// Every non-deleted, non-expired cached load for this owner+provider —
// strictly scoped to ownerId, so one company can never read another's
// cached results. Goes through the same lock as an in-flight ingest's
// write and an admin's policy change, so a read can't land between a
// revoke and the purge/scrub that follows it.
export async function readValid(ownerId: string, provider: LoadSourceProvider): Promise<CachedLoad[]> {
  return withCacheLock(policyLockKey(provider), () => readValidSync(ownerId, provider));
}

// Physically removes entries from disk — hiding via readValid isn't enough
// for either case this handles:
//  - expired entries: no reason to keep them once they can never be read.
//  - a provider whose allowStore has been revoked: we no longer have the
//    right to retain that data at all, for any owner, so every one of that
//    provider's entries is deleted outright, not just hidden.
// Revoking only allowDisplay is deliberately NOT handled here — that's a
// read-time visibility gate (lib/load-search.ts), not a storage-rights
// gate, so it must leave the underlying entries physically untouched.
export function purgeLoadCache(
  policyFor: (provider: LoadSourceProvider) => LoadProviderPolicy = getProviderPolicy
): void {
  const s = readAll();
  const now = Date.now();
  let changed = false;
  for (const [k, e] of Object.entries(s)) {
    const expired = new Date(e.expiresAt).getTime() <= now;
    const storeRevoked = !policyFor(e.provider).allowStore;
    if (expired || storeRevoked) {
      delete s[k];
      changed = true;
    }
  }
  if (changed) writeAll(s);
}

// Strips broker.contact from every stored load for one provider (any
// owner) without touching anything else about the entry — for revoking
// only allowBrokerContactStorage while allowStore stays on, where the load
// itself is still allowed to stay cached, just not with a retained broker
// contact. purgeLoadCache() already deletes the whole entry when allowStore
// itself is gone, so this only ever has something to do when store is
// still permitted.
export function scrubBrokerContact(provider: LoadSourceProvider): void {
  const s = readAll();
  let changed = false;
  for (const e of Object.values(s)) {
    if (e.provider === provider && e.load && e.load.broker !== null) {
      e.load = { ...e.load, broker: null };
      changed = true;
    }
  }
  if (changed) writeAll(s);
}

// upsertBatch/deleteLoad/purgeLoadCache/scrubBrokerContact above are
// deliberately lock-naive — they assume the caller already holds
// withCacheLock(policyLockKey(provider)) when correctness depends on it.
// lib/load-ingest.ts holds it around its policy re-check + upsertBatch, and
// app/api/admin/load-provider-policy/route.ts holds it around
// setPolicyRecord + purgeLoadCache/scrubBrokerContact — see those for why.
