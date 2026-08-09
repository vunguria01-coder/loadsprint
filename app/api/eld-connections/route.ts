import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { eldConnectSchema } from "@/lib/schemas";
import { listEldConnections } from "@/lib/eld-connections";
import { saveEldConnectionAndReset, deleteEldConnectionAndCleanup } from "@/lib/eld-connection-lifecycle";
import { eldMasterKeyConfigured } from "@/lib/eld-connection-crypto";
import { ELD_PROVIDERS } from "@/lib/eld-adapters";

// Status only, ever — GET/POST/DELETE here never return a secret, and the
// secret is never written to a log line on any path below. Scoped per
// company (owner id from the session only — never a client-supplied
// ownerId). A driver session can never reach any of these three handlers:
// requireDispatcher below excludes "driver" the same way every other
// dispatcher-only route in this codebase does.
//
// POST's body schema (eldConnectSchema) has no `verified` field at all —
// there is no way for a client to set it. verified is only ever written by
// lib/eld-connections.ts's verifyEldConnection() after it actually calls
// the provider, and POST here (via saveEldConnectionAndReset) always
// resets it to false along with bumping the revision and purging any
// links/snapshots made under the credential being replaced.

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
  return NextResponse.json({
    ok: true,
    configured: eldMasterKeyConfigured(),
    connections: listEldConnections(ownerId),
  });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (!requireDispatcher(me)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!eldMasterKeyConfigured()) {
    // Fail closed — nothing is written, not even the ciphertext, when the
    // master key isn't set. There is no path from here to a plaintext
    // write on disk.
    return NextResponse.json(
      { ok: false, error: "ELD connections aren't configured on this server yet." },
      { status: 503 }
    );
  }
  const parsed = eldConnectSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "form"}: ${i.message}`)
      .join("; ");
    return NextResponse.json({ ok: false, error: detail || "Invalid data" }, { status: 400 });
  }
  const ownerId = me.ownerId || me.id;
  const summary = await saveEldConnectionAndReset(ownerId, parsed.data.provider, parsed.data.secret);
  return NextResponse.json({ ok: true, connection: summary });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (!requireDispatcher(me)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const provider = new URL(req.url).searchParams.get("provider") || "";
  if (!(ELD_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  }
  const ownerId = me.ownerId || me.id;
  await deleteEldConnectionAndCleanup(ownerId, provider as (typeof ELD_PROVIDERS)[number]);
  return NextResponse.json({ ok: true });
}
