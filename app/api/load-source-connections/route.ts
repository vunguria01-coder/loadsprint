import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { loadSourceConnectSchema } from "@/lib/schemas";
import {
  listConnections,
  saveConnection,
  deleteConnection,
  LOAD_SOURCE_PROVIDERS,
} from "@/lib/load-source-connections";
import { masterKeyConfigured } from "@/lib/load-source-crypto";

// Status only, ever — GET/POST/DELETE here never return a secret, and the
// secret is never written to a log line on any path below. Scoped per
// company (owner id, shared with sub-dispatchers), same as driver-pay.

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
    configured: masterKeyConfigured(),
    connections: listConnections(ownerId),
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
  if (!masterKeyConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Load-source connections aren't configured on this server yet." },
      { status: 503 }
    );
  }
  const parsed = loadSourceConnectSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "form"}: ${i.message}`)
      .join("; ");
    return NextResponse.json({ ok: false, error: detail || "Invalid data" }, { status: 400 });
  }
  const ownerId = me.ownerId || me.id;
  const summary = saveConnection(ownerId, parsed.data.provider, parsed.data.secret);
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
  if (!(LOAD_SOURCE_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  }
  const ownerId = me.ownerId || me.id;
  deleteConnection(ownerId, provider as (typeof LOAD_SOURCE_PROVIDERS)[number]);
  return NextResponse.json({ ok: true });
}
