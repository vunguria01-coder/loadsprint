import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { reverseGeocodeHere } from "@/lib/here";

// GET /api/geo/reverse?lat=..&lng=..  → { city, state, label }
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "Bad coordinates" }, { status: 400 });
  }
  const r = await reverseGeocodeHere(lat, lng);
  if (!r) return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 502 });
  const cityState = [r.city, r.state].filter(Boolean).join(", ");
  return NextResponse.json({ ok: true, ...r, cityState });
}
