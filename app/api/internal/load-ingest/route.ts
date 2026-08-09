import { NextResponse } from "next/server";
import crypto from "crypto";
import { runLoadIngestionJob } from "@/lib/load-ingest-job";

export const runtime = "nodejs";

// POST /api/internal/load-ingest — the future Railway Cron target. No
// schedule is wired to it yet (no cron config, no LOAD_INGEST_CRON_SECRET
// set anywhere) — this only exists so the endpoint itself can be reviewed
// and tested in isolation first.
//
// Auth is Authorization: Bearer <LOAD_INGEST_CRON_SECRET> only — never a
// query param or body field, and never logged. The secret is compared with
// a fixed-length hash + crypto.timingSafeEqual so neither a missing env var
// nor a wrong/missing token is distinguishable by timing, and both come
// back as the exact same 401.
//
// The job itself always runs unparameterized — this route never accepts
// (or even reads) an ownerId/provider from the request, so it can't be used
// to target one tenant. The response is aggregate counts only: no owner
// ids, no credentials, no load content.

function noStore(body: unknown, status: number) {
  return NextResponse.json(body as object, { status, headers: { "Cache-Control": "no-store" } });
}

function safeEqual(a: string, b: string): boolean {
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.LOAD_INGEST_CRON_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  // Always run the comparison, even with empty inputs, so "no env set" and
  // "wrong token" take the same code path — only the length check below
  // (not the token's actual value) short-circuits it.
  const matches = safeEqual(token, secret);
  return secret.length > 0 && matches;
}

// No per-owner query source exists for a scheduled run yet (a search query
// is built from one driver's location + profile — see lib/load-search.ts —
// which a cron trigger has no way to pick on its own). Returning null here
// means every pair the job walks resolves to "not_eligible", the same as
// today's interactive path, until that's designed.
function buildQuery() {
  return null;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return noStore({ ok: false, error: "Unauthorized" }, 401);
  }

  const outcomes = await runLoadIngestionJob(buildQuery);
  const counts = { success: 0, failed: 0, skipped: 0, alreadyRunning: 0 };
  for (const outcome of Object.values(outcomes)) {
    if (outcome === "ran") counts.success++;
    else if (outcome === "error") counts.failed++;
    else if (outcome === "already_running") counts.alreadyRunning++;
    else counts.skipped++;
  }

  return noStore({ ok: true, counts }, 200);
}
