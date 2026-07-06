import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { addExpense, removeExpense, EXPENSE_KINDS, type ExpenseKind } from "@/lib/trucks";

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

// POST /api/trucks/:id/expense — log a cost against the truck.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const kind = (EXPENSE_KINDS as readonly string[]).includes(b.kind)
    ? (b.kind as ExpenseKind)
    : null;
  if (!kind) return NextResponse.json({ ok: false, error: "Pick an expense type." }, { status: 400 });
  const amount = num(b.amount);
  if (!amount || amount <= 0)
    return NextResponse.json({ ok: false, error: "Enter an amount." }, { status: 400 });

  const t = addExpense(id, me.ownerId || me.id, me.role === "admin", {
    kind,
    amount,
    date: b.date ? String(b.date) : undefined,
    note: b.note ? String(b.note) : undefined,
    odometer: num(b.odometer),
    gallons: num(b.gallons),
    fuelCardId: b.fuelCardId ? String(b.fuelCardId) : undefined,
  });
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trucks/:id/expense — remove one expense by its id.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const { expenseId } = await req.json().catch(() => ({}));
  if (!expenseId) return NextResponse.json({ ok: false, error: "Expense id required." }, { status: 400 });
  const t = removeExpense(id, me.ownerId || me.id, me.role === "admin", String(expenseId));
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
