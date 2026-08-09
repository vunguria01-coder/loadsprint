import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getInvitesByRole } from "@/lib/invites";
import { driverSearchProfileSchema } from "@/lib/schemas";
import { getDriverSearchProfile, setDriverSearchProfile } from "@/lib/driver-search-profile";

// A dispatcher's load-search preferences for one of their own drivers
// (equipment, trailer length, deadhead radius, preferred directions,
// minimum rate per mile). No search runs from here yet — this only reads
// and writes the profile. GET /api/driver-search-profile?email=...,
// POST { email, ...driverSearchProfileSchema }.

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
  // Same roster check as /api/drivers/password: this dispatcher must have
  // invited the driver (admin exempt) — a dispatcher at one company can
  // neither read nor write a driver's profile at another.
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
  return NextResponse.json({ ok: true, profile: getDriverSearchProfile(me.id, target) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const target = String(body.email || "").trim().toLowerCase();
  const access = checkAccess(me, target);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }
  const parsed = driverSearchProfileSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "form"}: ${i.message}`)
      .join("; ");
    return NextResponse.json({ ok: false, error: detail || "Invalid data" }, { status: 400 });
  }
  const profile = setDriverSearchProfile(me.id, target, parsed.data);
  return NextResponse.json({ ok: true, profile });
}
