import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { loadProviderPolicyInputSchema } from "@/lib/schemas";
import { LOAD_SOURCE_PROVIDERS } from "@/lib/load-source-connections";
import {
  listPolicyRecords,
  setPolicyRecord,
  listAuditLog,
  validatePolicyInput,
} from "@/lib/load-provider-policy";
import { purgeLoadCache, scrubBrokerContact } from "@/lib/load-cache";
import { withCacheLock, policyLockKey } from "@/lib/load-cache-lock";

// Admin-only registry for load-board provider rights — a dispatcher can
// never reach this route (403), and there is no code path anywhere else
// that flips a provider's effective policy away from fully-restrictive.
// GET returns every provider's record plus its audit trail (reference
// numbers and timestamps only — never a secret or agreement text). POST
// writes one provider's record and its cache sync (purge / broker scrub)
// under the SAME lock lib/load-ingest.ts uses around its write, so a
// revoke can never interleave with an in-flight ingest that started under
// the old policy — either the ingest's write loses the race and is
// discarded, or this write waits until it's done and then immediately
// undoes whatever it wrote.

export async function GET() {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const sources = listPolicyRecords().map(({ provider, record }) => ({
    provider,
    record,
    audit: listAuditLog(provider),
  }));
  return NextResponse.json({ ok: true, sources });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = body?.provider;
  if (!(LOAD_SOURCE_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  }

  const parsed = loadProviderPolicyInputSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join("; ");
    return NextResponse.json({ ok: false, error: detail || "Invalid data" }, { status: 400 });
  }

  const errors = validatePolicyInput(parsed.data);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: errors.map((e) => `${e.field}: ${e.message}`).join("; ") },
      { status: 400 }
    );
  }

  let record;
  try {
    record = await withCacheLock(policyLockKey(provider), () => {
      const written = setPolicyRecord(provider, parsed.data, me.id);
      // Any change (approve, tighten rights, or revoke) may have just made
      // the in-effect policy more restrictive than the cache reflects —
      // sync now instead of waiting for the next search/ingest to trigger it.
      purgeLoadCache();
      if (!written.allowBrokerContactStorage) scrubBrokerContact(provider);
      return written;
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Invalid policy" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, record });
}
