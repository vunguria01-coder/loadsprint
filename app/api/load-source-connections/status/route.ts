import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { listConnections, LOAD_SOURCE_PROVIDERS } from "@/lib/load-source-connections";
import { getAdapter } from "@/lib/load-source-adapters";
import { getPolicyRecord, getProviderPolicy, computeReadiness } from "@/lib/load-provider-policy";
import { getJobStatus } from "@/lib/load-ingest-job";
import { readValid } from "@/lib/load-cache";

// GET /api/load-source-connections/status
// Honest per-provider readiness for the Load sources page — every gate
// shown independently rather than folded into one flag, so "credentials
// saved" can never be read as "loads will show." ownerId always comes from
// the session (currentUser()) — there is no query param or body field for
// it, so one tenant can never ask for another's status. Never returns a
// secret or any load content, only counts and timestamps.

function requireDispatcher(me: { role: string } | null) {
  return !!me && (me.role === "dispatcher" || me.role === "admin");
}

export async function GET() {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (!requireDispatcher(me)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const ownerId = me.ownerId || me.id;

  const connections = listConnections(ownerId);
  const sources = await Promise.all(LOAD_SOURCE_PROVIDERS.map(async (provider) => {
    const conn = connections.find((c) => c.provider === provider);
    const credentials = conn?.status === "credentials_saved" ? "saved" : "missing";

    // The admin's raw status/expiry (not the collapsed rights) is what
    // "written permission" honestly reflects — approved-but-expired must
    // read as pending, same as never having been approved at all.
    const record = getPolicyRecord(provider);
    const expired = !!record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now();
    const writtenPermission = record.status === "approved" && !expired ? "approved" : "pending";

    // The actually-enforced rights — already collapsed to fully-denied by
    // getProviderPolicy if the record isn't a current "approved" one.
    const policy = getProviderPolicy(provider);

    const adapterActive = getAdapter(provider).active;
    const adapter = adapterActive ? "active" : "disabled";

    const job = getJobStatus(ownerId, provider);
    const cachedLoadCount = (await readValid(ownerId, provider)).length;

    const readiness = computeReadiness(credentials, writtenPermission, adapterActive, policy);

    return {
      provider,
      credentials,
      writtenPermission,
      adapter,
      allowFetch: policy.allowFetch,
      allowStore: policy.allowStore,
      allowDisplay: policy.allowDisplay,
      cacheTtlSeconds: policy.cacheTtlSeconds,
      lastSuccessAt: job.lastSuccessAt,
      nextEligibleAt: job.nextEligibleAt,
      loadsFetched: job.loadsFetched,
      lastErrorCode: job.lastErrorCode,
      cachedLoadCount,
      readiness,
    };
  }));

  return NextResponse.json({ ok: true, sources });
}
