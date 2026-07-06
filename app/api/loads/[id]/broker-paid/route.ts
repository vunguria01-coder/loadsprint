import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { setBrokerPaid } from "@/lib/loads";

// POST /api/loads/:id/broker-paid  { paid: boolean }
// The dispatcher records whether the broker has paid for a delivered load.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  if (me.role !== "dispatcher" && me.role !== "admin")
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (me.role === "dispatcher" && !hasAccess(me))
    return NextResponse.json({ ok: false, error: "Activate a plan first." }, { status: 402 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const paid = !!body.paid;
  const load = setBrokerPaid(id, paid, me.id, me.role === "admin");
  if (!load) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, paid });
}
