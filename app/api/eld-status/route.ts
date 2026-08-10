import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getInvitesByRole } from "@/lib/invites";
import { getEldDriverLink } from "@/lib/eld-driver-links";
import { getEldConnectionGate, checkEldConnectionGate } from "@/lib/eld-connections";
import { getEldSnapshotStatus, getDecryptedEldSnapshot } from "@/lib/eld-snapshots";
import type { EldStatusState } from "@/lib/eld-format";

// GET /api/eld-status?email=... — tenant-scoped ELD/HOS status for one
// driver's card. Same roster check as /api/driver-search-profile and
// /api/eld-driver-links: this dispatcher must have invited the driver
// (admin exempt). Always Cache-Control: no-store — HOS data is exactly the
// kind of thing that must never come from a stale browser/CDN cache.
//
// The response is ALWAYS one of six states — never a raw error code, never
// credentials, never accountId or externalDriverId (those are provider-
// side identifiers with no reason to reach the browser). "available" is
// the only state carrying data, and only the fields explicitly meant for
// the driver card: duty status, the four HOS clocks, vehicle name/VIN, and
// the two timestamps (when the provider last computed this vs when
// LoadSprint fetched it).
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
  const owns = getInvitesByRole(me.id, "driver").some((i) => i.email.toLowerCase() === target);
  if (!owns && me.role !== "admin") {
    return { ok: false, status: 404, error: "This driver isn't on your roster." };
  }
  return { ok: true };
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body as object, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) {
    return noStore({ ok: false, error: "Please sign in first." }, 401);
  }
  const target = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() || "";
  const access = checkAccess(me, target);
  if (!access.ok) {
    return noStore({ ok: false, error: access.error }, access.status);
  }
  const ownerId = me.ownerId || me.id;

  const link = getEldDriverLink(ownerId, target);
  if (!link) {
    return noStore({ ok: true, state: "not_linked" satisfies EldStatusState });
  }

  const gate = checkEldConnectionGate(getEldConnectionGate(ownerId, link.provider), "hos_read");
  if (!gate.ok) {
    // missing_capability folds into not_verified for display purposes —
    // both mean the same thing to a dispatcher: this connection hasn't
    // proven it can be used for HOS data right now.
    const state: EldStatusState = gate.code === "connection_missing" ? "not_connected" : "not_verified";
    return noStore({ ok: true, state });
  }

  const snapshotStatus = await getEldSnapshotStatus(ownerId, target);
  if (!snapshotStatus || !snapshotStatus.hasSnapshot) {
    return noStore({ ok: true, state: "no_data" satisfies EldStatusState });
  }

  let snapshot;
  try {
    snapshot = await getDecryptedEldSnapshot(ownerId, target);
  } catch {
    // A tampered or otherwise unreadable ciphertext — never surface the
    // crypto failure, just report the honest "can't read it right now."
    return noStore({ ok: true, state: "temporarily_unavailable" satisfies EldStatusState });
  }
  if (!snapshot) {
    return noStore({ ok: true, state: "no_data" satisfies EldStatusState });
  }

  return noStore({
    ok: true,
    state: "available" satisfies EldStatusState,
    dutyStatus: snapshot.dutyStatus,
    driveRemainingMin: snapshot.driveRemainingMin,
    shiftRemainingMin: snapshot.shiftRemainingMin,
    cycleRemainingMin: snapshot.cycleRemainingMin,
    breakRemainingMin: snapshot.breakRemainingMin,
    vehicleName: snapshot.vehicleName,
    vehicleVin: snapshot.vehicleVin,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    fetchedAt: snapshot.fetchedAt,
  });
}
