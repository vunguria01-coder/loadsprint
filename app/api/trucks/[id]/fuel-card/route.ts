import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { addFuelCard, removeFuelCard } from "@/lib/trucks";

async function gate() {
  const me = await currentUser();
  if (!me) return { err: NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 }) };
  if (me.role !== "dispatcher" && me.role !== "admin")
    return { err: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  if (me.role === "dispatcher" && !hasAccess(me))
    return { err: NextResponse.json({ ok: false, error: "Activate a plan first." }, { status: 402 }) };
  return { me };
}

// POST /api/trucks/:id/fuel-card — attach a fuel card to the truck.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const label = String(b.label || "").trim();
  if (!label) return NextResponse.json({ ok: false, error: "Card name required." }, { status: 400 });

  const t = addFuelCard(id, me.ownerId || me.id, me.role === "admin", {
    label,
    provider: b.provider ? String(b.provider) : undefined,
    last4: b.last4 ? String(b.last4) : undefined,
    note: b.note ? String(b.note) : undefined,
  });
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trucks/:id/fuel-card — remove a fuel card by its id.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const { cardId } = await req.json().catch(() => ({}));
  if (!cardId) return NextResponse.json({ ok: false, error: "Card id required." }, { status: 400 });
  const t = removeFuelCard(id, me.ownerId || me.id, me.role === "admin", String(cardId));
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
