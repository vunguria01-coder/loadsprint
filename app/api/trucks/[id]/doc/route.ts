import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { addTruckDoc, removeTruckDoc, DOC_KINDS, type DocKind } from "@/lib/trucks";

async function gate() {
  const me = await currentUser();
  if (!me) return { err: NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 }) };
  if (me.role !== "dispatcher" && me.role !== "admin")
    return { err: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  if (me.role === "dispatcher" && !hasAccess(me))
    return { err: NextResponse.json({ ok: false, error: "Activate a plan first." }, { status: 402 }) };
  return { me };
}

// POST /api/trucks/:id/doc — add an expiring compliance document.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const kind = (DOC_KINDS as readonly string[]).includes(b.kind) ? (b.kind as DocKind) : null;
  if (!kind) return NextResponse.json({ ok: false, error: "Pick a document type." }, { status: 400 });
  const expiryDate = String(b.expiryDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(expiryDate))
    return NextResponse.json({ ok: false, error: "Enter an expiry date." }, { status: 400 });

  const t = addTruckDoc(id, me.ownerId || me.id, me.role === "admin", {
    kind,
    expiryDate,
    note: b.note ? String(b.note) : undefined,
  });
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trucks/:id/doc — remove a document by id.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const { docId } = await req.json().catch(() => ({}));
  if (!docId) return NextResponse.json({ ok: false, error: "Document id required." }, { status: 400 });
  const t = removeTruckDoc(id, me.ownerId || me.id, me.role === "admin", String(docId));
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
