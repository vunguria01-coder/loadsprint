import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { addMaintenance, removeMaintenance, MAINT_KINDS, type MaintKind } from "@/lib/trucks";

async function gate() {
  const me = await currentUser();
  if (!me) return { err: NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 }) };
  if (me.role !== "dispatcher" && me.role !== "admin")
    return { err: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  if (me.role === "dispatcher" && !hasAccess(me))
    return { err: NextResponse.json({ ok: false, error: "Activate a plan first." }, { status: 402 }) };
  return { me };
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// POST /api/trucks/:id/maintenance — add a mileage-based service schedule.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const kind = (MAINT_KINDS as readonly string[]).includes(b.kind) ? (b.kind as MaintKind) : null;
  if (!kind) return NextResponse.json({ ok: false, error: "Pick a service type." }, { status: 400 });

  const t = addMaintenance(id, me.ownerId || me.id, me.role === "admin", {
    kind,
    intervalMiles: num(b.intervalMiles),
    lastServiceMiles: num(b.lastServiceMiles),
    lastServiceDate: b.lastServiceDate ? String(b.lastServiceDate) : undefined,
    note: b.note ? String(b.note) : undefined,
  });
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trucks/:id/maintenance — remove a schedule by id.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const { itemId } = await req.json().catch(() => ({}));
  if (!itemId) return NextResponse.json({ ok: false, error: "Item id required." }, { status: 400 });
  const t = removeMaintenance(id, me.ownerId || me.id, me.role === "admin", String(itemId));
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
