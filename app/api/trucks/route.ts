import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { createTruck, deleteTruck, ELD_PROVIDERS, type EldProvider } from "@/lib/trucks";

// Gate every truck mutation: signed-in dispatcher/admin with an active plan.
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

// POST /api/trucks — create a truck.
export async function POST(req: Request) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Truck name required." }, { status: 400 });

  const eldProvider = (ELD_PROVIDERS as readonly string[]).includes(b.eldProvider)
    ? (b.eldProvider as EldProvider)
    : "none";

  const truck = createTruck({
    ownerId: me.ownerId || me.id,
    name,
    unit: b.unit ? String(b.unit) : undefined,
    vin: b.vin ? String(b.vin) : undefined,
    plate: b.plate ? String(b.plate) : undefined,
    make: b.make ? String(b.make) : undefined,
    model: b.model ? String(b.model) : undefined,
    year: num(b.year),
    driverEmail: b.driverEmail ? String(b.driverEmail) : undefined,
    purchasePrice: num(b.purchasePrice),
    purchaseDate: b.purchaseDate ? String(b.purchaseDate) : undefined,
    eldProvider,
    eldVehicleId: b.eldVehicleId ? String(b.eldVehicleId) : undefined,
  });
  return NextResponse.json({ ok: true, id: truck.id });
}

// DELETE /api/trucks — remove a truck by id.
export async function DELETE(req: Request) {
  const g = await gate();
  if (g.err) return g.err;
  const me = g.me!;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "Truck id required." }, { status: 400 });
  const ok = deleteTruck(String(id), me.ownerId || me.id, me.role === "admin");
  if (!ok) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
