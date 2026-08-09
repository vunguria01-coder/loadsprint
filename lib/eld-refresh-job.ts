import { getEldDriverLink, listAllEldDriverLinks } from "@/lib/eld-driver-links";
import { getEldConnectionGate, checkEldConnectionGate, getDecryptedEldCredential } from "@/lib/eld-connections";
import { getEldAdapter, validateEldSnapshot } from "@/lib/eld-adapters";
import { recordEldSnapshotFailureSync, recordEldSnapshotSuccessSync } from "@/lib/eld-snapshots";
import { withEldConnectionLock } from "@/lib/eld-connections-lock";
import { encryptEldData } from "@/lib/eld-data-crypto";
import type { EldAdapter, EldProvider, NormalizedEldSnapshot } from "@/lib/eld-adapters";
import type { EldDriverLink } from "@/lib/eld-driver-links";

const DEFAULT_TIMEOUT_MS = 20_000;

// Safe aggregate counters only — no owner ids, no driver emails, no
// snapshot content, same convention as lib/load-ingest-job.ts.
export type EldRefreshJobCounts = {
  groups: number;
  driversRequested: number;
  success: number;
  failed: number;
  skipped: number;
};

type LinkEntry = { driverEmail: string; link: EldDriverLink };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Fleet-level batch refresh — one fetchSnapshots() call per chunk instead
// of one fetchSnapshot() call per driver. Groups every driver link by
// owner+provider (one credential, one adapter, one batch budget), decrypts
// the credential ONCE per group, and splits that group's drivers into
// SEQUENTIAL chunks of adapter.maxBatchSize — chunks are processed one
// after another, never concurrently, since nothing here knows what
// parallelism a real provider's rate limits would actually tolerate.
//
// Every chunk write happens under lib/eld-connections-lock.ts, re-checking
// each driver's link and the connection's gate fresh at write time — the
// same anti-race discipline as lib/eld-refresh.ts's single-driver path,
// just applied per-chunk instead of per-call.
export async function runEldRefreshJob(
  adapterFor: (p: EldProvider) => EldAdapter = getEldAdapter,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  links: { ownerId: string; driverEmail: string; link: EldDriverLink }[] = listAllEldDriverLinks()
): Promise<EldRefreshJobCounts> {
  const counts: EldRefreshJobCounts = { groups: 0, driversRequested: 0, success: 0, failed: 0, skipped: 0 };

  const groups = new Map<string, { ownerId: string; provider: EldProvider; entries: LinkEntry[] }>();
  for (const { ownerId, driverEmail, link } of links) {
    const groupKey = `${ownerId}|${link.provider}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { ownerId, provider: link.provider, entries: [] };
      groups.set(groupKey, group);
    }
    group.entries.push({ driverEmail, link });
  }

  for (const { ownerId, provider, entries } of groups.values()) {
    counts.groups++;
    counts.driversRequested += entries.length;

    // Fail-closed before any network call: same gate as the single-driver
    // path. One decision for the whole group — a group that isn't
    // eligible never gets a fetchSnapshots() call at all.
    const gate = checkEldConnectionGate(getEldConnectionGate(ownerId, provider), "hos_read");
    const adapter = adapterFor(provider);
    if (!gate.ok || !adapter.active) {
      counts.skipped += entries.length;
      continue;
    }

    let credential: string | null;
    try {
      credential = await getDecryptedEldCredential(ownerId, provider);
    } catch {
      credential = null;
    }
    if (!credential) {
      counts.skipped += entries.length;
      continue;
    }

    const batchSize = Math.max(1, adapter.maxBatchSize);
    for (const batch of chunk(entries, batchSize)) {
      const requestedIds = batch.map((e) => e.link.externalDriverId);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let results: NormalizedEldSnapshot[];
      try {
        results = await adapter.fetchSnapshots(credential, requestedIds, controller.signal);
      } catch (e) {
        clearTimeout(timer);
        const code = e instanceof Error && e.name === "AbortError" ? "timeout" : "fetch_failed";
        await withEldConnectionLock(ownerId, () => {
          for (const { driverEmail, link } of batch) {
            recordEldSnapshotFailureSync(ownerId, driverEmail, provider, link.externalDriverId, code);
          }
        });
        counts.failed += batch.length;
        continue;
      }
      clearTimeout(timer);

      // A duplicate id, or an id nobody in this chunk asked for, means the
      // provider's response can't be trusted to belong to the right
      // drivers at all — reject the WHOLE chunk rather than guess which
      // entry is the trustworthy one.
      const requestedSet = new Set(requestedIds);
      const seen = new Set<string>();
      let badResponse = false;
      for (const r of results) {
        if (!requestedSet.has(r.externalDriverId) || seen.has(r.externalDriverId)) {
          badResponse = true;
          break;
        }
        seen.add(r.externalDriverId);
      }
      if (badResponse) {
        await withEldConnectionLock(ownerId, () => {
          for (const { driverEmail, link } of batch) {
            recordEldSnapshotFailureSync(ownerId, driverEmail, provider, link.externalDriverId, "adapter_bad_response");
          }
        });
        counts.failed += batch.length;
        continue;
      }

      const byId = new Map(results.map((r) => [r.externalDriverId, r]));

      await withEldConnectionLock(ownerId, () => {
        // Re-check the group's gate once per chunk, under the lock — the
        // network call above had no lock held across it, so credentials
        // could have been replaced while it was in flight.
        const freshGate = checkEldConnectionGate(getEldConnectionGate(ownerId, provider), "hos_read");

        for (const { driverEmail, link } of batch) {
          if (!freshGate.ok) {
            recordEldSnapshotFailureSync(ownerId, driverEmail, provider, link.externalDriverId, "stale_response_discarded");
            counts.failed++;
            continue;
          }

          // Per-driver: has THIS driver's link disappeared or been
          // repointed since the request started? Only this driver is
          // affected — the rest of the chunk can still be written.
          const freshLink = getEldDriverLink(ownerId, driverEmail);
          const staleLink =
            !freshLink || freshLink.provider !== provider || freshLink.externalDriverId !== link.externalDriverId;
          if (staleLink) {
            recordEldSnapshotFailureSync(ownerId, driverEmail, provider, link.externalDriverId, "stale_response_discarded");
            counts.failed++;
            continue;
          }

          const result = byId.get(link.externalDriverId);
          if (!result) {
            // Requested but absent from the response — spoils only this
            // driver; the previous good snapshot (if any) is untouched.
            recordEldSnapshotFailureSync(ownerId, driverEmail, provider, link.externalDriverId, "missing_from_batch");
            counts.failed++;
            continue;
          }

          const errors = validateEldSnapshot(result);
          const mismatched = result.provider !== provider || result.externalDriverId !== link.externalDriverId;
          if (errors.length > 0 || mismatched) {
            recordEldSnapshotFailureSync(ownerId, driverEmail, provider, link.externalDriverId, "invalid_snapshot");
            counts.failed++;
            continue;
          }

          const encrypted = encryptEldData(JSON.stringify(result), ownerId, driverEmail, provider, link.externalDriverId);
          recordEldSnapshotSuccessSync(ownerId, driverEmail, provider, link.externalDriverId, encrypted);
          counts.success++;
        }
      });
    }
  }

  return counts;
}
