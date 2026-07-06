import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById, currentPoint } from "@/lib/loads";
import { ensureStopsGeocoded } from "@/lib/geocode-stops";

export const dynamic = "force-dynamic";

// TEMP: return the raw HERE section polylines so the flexible-polyline decoder
// can be debugged offline. Owner/admin only. Never returns the key.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  let load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const owns = me.role === "admin" || load.dispatcherId === me.id;
  if (!owns) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const key = process.env.HERE_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "no key" });

  load = await ensureStopsGeocoded(load);
  const stops = (load.stops || []).filter((s) => s.point).map((s) => ({ lat: s.point!.lat, lng: s.point!.lng }));
  const pts = stops.length >= 2 ? stops : [load.origin, load.dest];
  const origin = currentPoint(load);
  const dest = pts[pts.length - 1];
  const via = pts.slice(0, -1);
  const viaStr = via.map((p) => `&via=${p.lat},${p.lng}`).join("");
  const url =
    `https://router.hereapi.com/v8/routes?transportMode=truck&routingMode=fast` +
    `&origin=${origin.lat},${origin.lng}${viaStr}&destination=${dest.lat},${dest.lng}` +
    `&return=summary,polyline&units=imperial` +
    `&truck[height]=411&truck[width]=260&truck[length]=2200&truck[grossWeight]=15876&truck[axleCount]=5` +
    `&apikey=${key}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  const sections = data?.routes?.[0]?.sections || [];
  const out = sections.map((s: { polyline?: string; summary?: { length?: number } }, i: number) => ({
    i,
    lengthMeters: s.summary?.length ?? null,
    polylineLen: typeof s.polyline === "string" ? s.polyline.length : 0,
    polyline: typeof s.polyline === "string" ? s.polyline : null,
  }));
  return NextResponse.json({ ok: true, sectionCount: sections.length, sections: out });
}
