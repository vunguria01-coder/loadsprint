import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById, currentPoint } from "@/lib/loads";
import { truckRoute } from "@/lib/here";
import { ensureStopsGeocoded } from "@/lib/geocode-stops";

// TEMP diagnostic: replicate the EXACT truck-route call the map makes (real
// stops + truck params + via) and report HERE's status/body/timing, so we can
// see why routing returns null. Owner/admin only. Never returns the key value.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const owns = me.role === "admin" || load.dispatcherId === me.id;
  if (!owns) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const key = process.env.HERE_API_KEY;
  const info = { hasKey: !!key, keyLen: key ? key.length : 0 };
  if (!key) return NextResponse.json({ ok: true, ...info, note: "HERE_API_KEY empty" });

  load = await ensureStopsGeocoded(load);
  const stops = (load.stops || []).filter((s) => s.point).map((s) => ({ lat: s.point!.lat, lng: s.point!.lng }));
  const pts = stops.length >= 2 ? stops : [load.origin, load.dest];
  const origin = currentPoint(load);
  const dest = pts[pts.length - 1];
  const via = pts.slice(0, -1);

  // 1) The library call the map actually uses.
  const t0 = Date.now();
  const r = await truckRoute(origin, dest, { via });
  const truckMs = Date.now() - t0;

  // 2) Raw replica so we can read HERE's status + body.
  const viaStr = via.map((p) => `&via=${p.lat},${p.lng}`).join("");
  const url =
    `https://router.hereapi.com/v8/routes?transportMode=truck&routingMode=fast` +
    `&origin=${origin.lat},${origin.lng}${viaStr}&destination=${dest.lat},${dest.lng}` +
    `&return=summary&units=imperial` +
    `&truck[height]=411&truck[width]=260&truck[length]=2200&truck[grossWeight]=15876&truck[axleCount]=5` +
    `&apikey=${key}`;
  let raw: Record<string, unknown> = {};
  const t1 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await res.text();
    raw = { rawStatus: res.status, rawMs: Date.now() - t1, rawBody: body.slice(0, 500) };
  } catch (e) {
    raw = { rawError: String(e).slice(0, 200), rawMs: Date.now() - t1 };
  }

  return NextResponse.json({
    ok: true,
    ...info,
    origin,
    dest,
    viaCount: via.length,
    truckRouteNull: r === null,
    truckPoints: r?.points?.length ?? null,
    truckMs,
    ...raw,
  });
}
