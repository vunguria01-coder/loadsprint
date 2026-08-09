import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAdapter } from "@/lib/load-source-adapters";
import { getProviderPolicy } from "@/lib/load-provider-policy";
import { listOwnersWithSavedConnections } from "@/lib/load-source-connections";
import { ingestFromActiveSources } from "@/lib/load-ingest";
import { acquireLease, renewLease, releaseLease } from "@/lib/load-ingest-lock";
import type { LoadSourceAdapter, LoadSearchQuery } from "@/lib/load-source-adapters";
import type { LoadProviderPolicy } from "@/lib/load-provider-policy";
import type { LoadSourceProvider } from "@/lib/load-source-connections";

// Safe coordinator for periodic ingestion — NOT wired to Railway Cron or
// any scheduler yet. Given a real trigger later, this is what it would
// call; today it only exists to be exercised by tests via
// dependency-injected adapter/policy/query lookups.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STATUS_FILE = path.join(DATA_DIR, "load-ingest-job-status.json");

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_ADAPTER_TIMEOUT_MS = 20_000;

// Deliberately minimal — no credentials, no raw API response, no load
// content. Just enough to schedule and to see what happened.
export type JobStatus = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextEligibleAt: string | null;
  loadsFetched: number;
  lastErrorCode: string | null;
};

const EMPTY_STATUS: JobStatus = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  nextEligibleAt: null,
  loadsFetched: 0,
  lastErrorCode: null,
};

type StatusStore = Record<string, JobStatus>;

function statusKey(ownerId: string, provider: LoadSourceProvider): string {
  return `${ownerId}|${provider}`;
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATUS_FILE)) fs.writeFileSync(STATUS_FILE, "{}", "utf8");
}

function readAll(): StatusStore {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")) as StatusStore;
  } catch {
    return {};
  }
}

function writeAll(s: StatusStore) {
  ensure();
  fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function getJobStatus(ownerId: string, provider: LoadSourceProvider): JobStatus {
  return readAll()[statusKey(ownerId, provider)] || { ...EMPTY_STATUS };
}

function setJobStatus(ownerId: string, provider: LoadSourceProvider, status: JobStatus): void {
  const s = readAll();
  s[statusKey(ownerId, provider)] = status;
  writeAll(s);
}

// A short, fixed bucket — never the provider's error message or response
// body, which could carry account/API details this file has no business
// persisting.
function classifyError(e: unknown): string {
  if (e instanceof Error && e.message === "adapter_timeout") return "timeout";
  if (e instanceof TypeError) return "adapter_bad_response";
  return "adapter_error";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("adapter_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export type BuildQuery = (ownerId: string, provider: LoadSourceProvider) => LoadSearchQuery | null;

// What happened to each owner+provider pair this run resolved — a neutral
// "already_running" is not an error: it means another process (or an
// overlapping call in this one) genuinely holds the lease right now.
export type JobRunOutcome = "ran" | "not_eligible" | "already_running" | "error";

export type RunLoadIngestionJobOptions = {
  leaseMs?: number;
  heartbeatMs?: number;
  adapterTimeoutMs?: number;
  now?: () => number;
};

// Walks every owner with at least one credentials_saved connection, and for
// each of that owner's connections whose adapter is active AND whose policy
// actually permits it, ingests on the schedule set by
// policy.refreshIntervalSeconds (never derived from cacheTtlSeconds — those
// are two different negotiated terms).
//
// Concurrency safety is a real cross-process file lease (lib/load-ingest-
// lock.ts), not an in-memory flag — it protects against two Node processes
// (or the old and new instance overlapping during a deploy) both trying to
// ingest the same owner+provider at once. The lease is renewed on a
// heartbeat while work is in flight, released only by its own runId (always
// in `finally`), and safely reclaimed if its holder crashed and let it
// expire. Every adapter call is time-boxed so a hung provider can't wedge
// the job (and, via the heartbeat lapsing, can't hold the lease forever
// either). One pair's error is caught and recorded per-pair; it never stops
// the rest of the run.
export async function runLoadIngestionJob(
  buildQuery: BuildQuery,
  owners: { ownerId: string; connections: { provider: LoadSourceProvider; status: string }[] }[] = listOwnersWithSavedConnections(),
  adapterFor: (provider: LoadSourceProvider) => LoadSourceAdapter = getAdapter,
  policyFor: (provider: LoadSourceProvider) => LoadProviderPolicy = getProviderPolicy,
  opts: RunLoadIngestionJobOptions = {}
): Promise<Record<string, JobRunOutcome>> {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  const heartbeatMs = opts.heartbeatMs ?? Math.max(1, Math.floor(leaseMs / 3));
  const adapterTimeoutMs = opts.adapterTimeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  const now = opts.now ?? Date.now;

  const outcomes: Record<string, JobRunOutcome> = {};

  for (const { ownerId, connections } of owners) {
    for (const { provider, status } of connections) {
      if (status !== "credentials_saved") continue;
      const key = statusKey(ownerId, provider);
      if (!adapterFor(provider).active) {
        outcomes[key] = "not_eligible";
        continue;
      }

      const policy = policyFor(provider);
      if (!policy.allowFetch || !policy.allowStore || policy.cacheTtlSeconds <= 0) {
        outcomes[key] = "not_eligible";
        continue;
      }

      const prior = getJobStatus(ownerId, provider);
      const nowMs = now();
      if (prior.nextEligibleAt && new Date(prior.nextEligibleAt).getTime() > nowMs) {
        outcomes[key] = "not_eligible";
        continue;
      }

      const query = buildQuery(ownerId, provider);
      if (!query) {
        outcomes[key] = "not_eligible";
        continue;
      }

      const runId = `${process.pid}-${crypto.randomUUID()}`;
      if (!acquireLease(key, leaseMs, runId, now)) {
        outcomes[key] = "already_running";
        continue;
      }

      const heartbeat = setInterval(() => {
        renewLease(key, runId, leaseMs, now);
      }, heartbeatMs);

      const nextEligibleAt = new Date(nowMs + policy.refreshIntervalSeconds * 1000).toISOString();
      try {
        const timeBoxedAdapterFor = (p: LoadSourceProvider): LoadSourceAdapter => {
          const real = adapterFor(p);
          return { ...real, searchLoads: (q) => withTimeout(real.searchLoads(q), adapterTimeoutMs) };
        };
        const loadsFetched = await ingestFromActiveSources(
          ownerId,
          [{ provider, status: "credentials_saved", updatedAt: null }],
          query,
          timeBoxedAdapterFor,
          policyFor
        );
        setJobStatus(ownerId, provider, {
          lastAttemptAt: new Date(nowMs).toISOString(),
          lastSuccessAt: new Date(nowMs).toISOString(),
          nextEligibleAt,
          loadsFetched,
          lastErrorCode: null,
        });
        outcomes[key] = "ran";
      } catch (e) {
        setJobStatus(ownerId, provider, {
          ...prior,
          lastAttemptAt: new Date(nowMs).toISOString(),
          nextEligibleAt,
          lastErrorCode: classifyError(e),
        });
        outcomes[key] = "error";
      } finally {
        clearInterval(heartbeat);
        releaseLease(key, runId);
      }
    }
  }
  return outcomes;
}
