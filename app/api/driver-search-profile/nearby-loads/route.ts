import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getInvitesByRole } from "@/lib/invites";
import { getDriverGlobalLocation } from "@/lib/driver-location";
import { getDriverSearchProfile } from "@/lib/driver-search-profile";
import { listConnections } from "@/lib/load-source-connections";
import { buildLoadSearchQuery, runLoadSearch } from "@/lib/load-search";

// GET /api/driver-search-profile/nearby-loads?email=...
// "Find loads near this driver," scoped to the dispatcher who owns them —
// same roster check as /api/driver-search-profile. Reads only the local
// cache (lib/load-cache.ts) — never calls a provider adapter directly. The
// cache is only ever populated by lib/load-ingest.ts, which isn't wired
// into any route or job yet, so today this can only ever return an empty
// list.

function checkAccess(
  me: { id: string; role: string },
  target: string
): { ok: true } | { ok: false; status: number; error: string } {
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  if (!target) {
    return { ok: false, status: 400, error: "Missing email" };
  }
  const owns = getInvitesByRole(me.id, "driver").some(
    (i) => i.email.toLowerCase() === target
  );
  if (!owns && me.role !== "admin") {
    return { ok: false, status: 404, error: "This driver isn't on your roster." };
  }
  return { ok: true };
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  const target = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() || "";
  const access = checkAccess(me, target);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const location = getDriverGlobalLocation(target);
  if (!location) {
    return NextResponse.json({ ok: true, location: null, loads: [], sourcesStatus: "no_location" });
  }

  const profile = getDriverSearchProfile(me.id, target);
  const query = buildLoadSearchQuery(location, profile);
  const ownerId = me.ownerId || me.id;
  const connections = listConnections(ownerId);
  const { loads, sourcesStatus } = await runLoadSearch(query, connections, ownerId);

  return NextResponse.json({
    ok: true,
    location: { lat: location.lat, lng: location.lng, at: location.at },
    loads,
    sourcesStatus,
  });
}
