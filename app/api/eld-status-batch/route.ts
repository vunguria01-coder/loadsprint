import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getInvitesByRole } from "@/lib/invites";
import { getEldDriverLink } from "@/lib/eld-driver-links";
import { getEldConnectionGate, checkEldConnectionGate } from "@/lib/eld-connections";
import { getEldSnapshotStatus, getDecryptedEldSnapshot } from "@/lib/eld-snapshots";

// GET /api/eld-status-batch — one tenant-scoped read covering this
// dispatcher's ENTIRE roster, for the Drivers list page. Deliberately takes
// no client-supplied email list: the roster (getInvitesByRole) already
// defines exactly which drivers this dispatcher may see — the same set
// every other driver-scoped route checks against — so there's nothing to
// validate per email and no way to probe another tenant's drivers through
// this route.
//
// Reads ONLY what's already stored (link + connection gate + snapshot) —
// never calls an ELD adapter, never touches the network, same as
// /api/eld-status. One driver's corrupted/unreadable snapshot (or any
// other per-driver failure) is caught and reported as
// temporarily_unavailable for that entry only; it never aborts the batch
// or 500s the whole response.
export type EldBatchState =
  | "not_linked"
  | "not_connected"
  | "not_verified"
  | "no_data"
  | "available"
  | "temporarily_unavailable";

export type EldBatchEntry =
  | { email: string; state: Exclude<EldBatchState, "available"> }
  | {
      email: string;
      state: "available";
      dutyStatus: string;
      driveRemainingMin: number | null;
      shiftRemainingMin: number | null;
      cycleRemainingMin: number | null;
      vehicleName: string | null;
      vehicleVin: string | null;
      sourceUpdatedAt: string | null;
      fetchedAt: string;
    };

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body as object, { status, headers: { "Cache-Control": "no-store" } });
}

async function statusFor(ownerId: string, email: string): Promise<EldBatchEntry> {
  try {
    const link = getEldDriverLink(ownerId, email);
    if (!link) return { email, state: "not_linked" };

    const gate = checkEldConnectionGate(getEldConnectionGate(ownerId, link.provider), "hos_read");
    if (!gate.ok) {
      const state = gate.code === "connection_missing" ? "not_connected" : "not_verified";
      return { email, state };
    }

    const snapshotStatus = await getEldSnapshotStatus(ownerId, email);
    if (!snapshotStatus || !snapshotStatus.hasSnapshot) {
      return { email, state: "no_data" };
    }

    const snapshot = await getDecryptedEldSnapshot(ownerId, email);
    if (!snapshot) return { email, state: "no_data" };

    return {
      email,
      state: "available",
      dutyStatus: snapshot.dutyStatus,
      driveRemainingMin: snapshot.driveRemainingMin,
      shiftRemainingMin: snapshot.shiftRemainingMin,
      cycleRemainingMin: snapshot.cycleRemainingMin,
      vehicleName: snapshot.vehicleName,
      vehicleVin: snapshot.vehicleVin,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      fetchedAt: snapshot.fetchedAt,
    };
  } catch {
    // A tampered ciphertext, a decrypt failure, or any other unexpected
    // read error for THIS driver only — never let it take down the batch.
    return { email, state: "temporarily_unavailable" };
  }
}

export async function GET() {
  const me = await currentUser();
  if (!me) {
    return noStore({ ok: false, error: "Please sign in first." }, 401);
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return noStore({ ok: false, error: "Forbidden" }, 403);
  }
  const ownerId = me.ownerId || me.id;
  const emails = Array.from(new Set(getInvitesByRole(me.id, "driver").map((i) => i.email.toLowerCase())));

  const drivers = await Promise.all(emails.map((email) => statusFor(ownerId, email)));

  return noStore({ ok: true, drivers });
}
