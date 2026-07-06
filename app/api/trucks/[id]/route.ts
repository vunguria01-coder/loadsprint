import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import {
  updateTruck,
  ELD_PROVIDERS,
  TRUCK_STATUSES,
  type EldProvider,
  type TruckStatus,
} from "@/lib/trucks";

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

// PATCH /api/trucks/:id — update truck fields, driver assignment, ELD or status.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const patch: Parameters<typeof updateTruck>[3] = {};
  for (const f of ["name", "unit", "vin", "plate", "make", "model", "driverEmail", "purchaseDate"] as const) {
    if (b[f] !== undefined) patch[f] = String(b[f]);
  }
  if (b.year !== undefined) patch.year = num(b.year);
  if (b.purchasePrice !== undefined) patch.purchasePrice = num(b.purchasePrice) ?? 0;
  if (b.status !== undefined && (TRUCK_STATUSES as readonly string[]).includes(b.status))
    patch.status = b.status as TruckStatus;
  if (b.eldProvider !== undefined && (ELD_PROVIDERS as readonly string[]).includes(b.eldProvider))
    patch.eldProvider = b.eldProvider as EldProvider;
  if (b.eldVehicleId !== undefined) patch.eldVehicleId = String(b.eldVehicleId);

  const t = updateTruck(id, me.ownerId || me.id, me.role === "admin", patch);
  if (!t) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
