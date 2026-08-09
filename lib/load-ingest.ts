import { getAdapter } from "@/lib/load-source-adapters";
import { getProviderPolicy } from "@/lib/load-provider-policy";
import { upsertBatch, purgeLoadCache } from "@/lib/load-cache";
import { withCacheLock, policyLockKey } from "@/lib/load-cache-lock";
import type { LoadSourceAdapter, LoadSearchQuery } from "@/lib/load-source-adapters";
import type { LoadProviderPolicy } from "@/lib/load-provider-policy";
import type { LoadSourceConnectionSummary, LoadSourceProvider } from "@/lib/load-source-connections";

// Populates lib/load-cache.ts from every credentials_saved AND active
// source for one owner — gated fail-closed by lib/load-provider-policy.ts
// on top of that: a provider needs BOTH allowFetch and allowStore before
// its adapter is even called, since fetching data we have no right to
// cache is pointless and possibly its own ToS problem. Every provider's
// policy defaults to fully restrictive, so this still ingests nothing in
// production today. Tests call this directly with dependency-injected
// adapter/policy lookups (fixtureAdapter + a permissive fixture policy) to
// exercise the cache without touching that gate.
//
// The network call (searchLoads) deliberately happens OUTSIDE any lock —
// it can take a while and holding a lock across it would block every other
// reader/writer of that provider's cache for no reason. But that leaves a
// window: an admin could revoke the policy while the request is in flight.
// So the policy is re-read fresh, under lib/load-cache-lock.ts's short
// mutex, in the same critical section as the actual write — if it's no
// longer valid by the time the response comes back, the batch is discarded
// instead of resurrecting data the policy no longer allows.
//
// Returns the total number of loads upserted, so a caller (e.g. the job
// status bookkeeping in lib/load-ingest-job.ts) can record a count without
// this function needing to know anything about jobs.
export async function ingestFromActiveSources(
  ownerId: string,
  connections: LoadSourceConnectionSummary[],
  query: LoadSearchQuery,
  adapterFor: (provider: LoadSourceProvider) => LoadSourceAdapter = getAdapter,
  policyFor: (provider: LoadSourceProvider) => LoadProviderPolicy = getProviderPolicy
): Promise<number> {
  purgeLoadCache(policyFor);

  const active = connections.filter(
    (c) => c.status === "credentials_saved" && adapterFor(c.provider).active
  );
  let total = 0;
  for (const c of active) {
    const policy = policyFor(c.provider);
    // cacheTtlSeconds <= 0 is treated as an invalid policy, not "cache
    // nothing for zero seconds" — an approved TTL is part of what makes a
    // policy usable at all, so this blocks the adapter call outright.
    if (!policy.allowFetch || !policy.allowStore || policy.cacheTtlSeconds <= 0) continue;

    const loads = await adapterFor(c.provider).searchLoads(query); // no lock held here

    const stored = await withCacheLock(policyLockKey(c.provider), () => {
      const fresh = policyFor(c.provider); // re-read — the request above may have outlived the policy that authorized it
      if (!fresh.allowFetch || !fresh.allowStore || fresh.cacheTtlSeconds <= 0) {
        return null; // no longer permitted — discard this batch entirely, write nothing
      }
      const toStore = fresh.allowBrokerContactStorage ? loads : loads.map((l) => ({ ...l, broker: null }));
      upsertBatch(ownerId, c.provider, toStore, fresh.cacheTtlSeconds * 1000);
      return toStore;
    });

    if (stored) total += stored.length;
  }
  return total;
}
