import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { truckRoute } from "@/lib/here";

// GET /api/loads/[id]/route-line → { points: [{lat,lng}] } truck route origin→dest.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const can =
    me.role === "admin" ||
    load.dispatcherId === me.id ||
    load.driverEmail.toLowerCase() === me.email.toLowerCase() ||
    load.brokerEmail.toLowerCase() === me.email.toLowerCase();
  if (!can) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const r = await truckRoute(load.origin, load.dest, { withSteps: true });
  if (!r) return NextResponse.json({ ok: false, error: "No route" }, { status: 502 });
  return NextResponse.json({ ok: true, points: r.points, distanceMeters: r.distanceMeters });
}
