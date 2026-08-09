import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getInvitesByRole } from "@/lib/invites";
import { eldDriverLinkSchema } from "@/lib/schemas";
import { getEldDriverLink, linkEldDriver, unlinkEldDriver, EldDriverLinkError } from "@/lib/eld-driver-links";

// A dispatcher's link between one of their own drivers and that driver's
// ELD record. GET/POST/DELETE all take an email (never an ownerId) and
// resolve the tenant from the session — same roster check as
// /api/driver-search-profile: this dispatcher must have invited the driver
// (admin exempt), so a dispatcher at one company can neither read nor
// write another company's link. No UI reads this yet.

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
  const ownerId = me.ownerId || me.id;
  return NextResponse.json({ ok: true, link: getEldDriverLink(ownerId, target) });
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
  const parsed = eldDriverLinkSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`).join("; ");
    return NextResponse.json({ ok: false, error: detail || "Invalid data" }, { status: 400 });
  }
  const ownerId = me.ownerId || me.id;
  try {
    const link = await linkEldDriver(ownerId, target, parsed.data.provider, parsed.data.externalDriverId, me.id);
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    if (e instanceof EldDriverLinkError) {
      const status = e.code === "adapter_inactive" ? 503 : 409;
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ ok: false, error: "Could not link this driver." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  const target = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() || "";
  const access = checkAccess(me, target);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }
  const ownerId = me.ownerId || me.id;
  await unlinkEldDriver(ownerId, target);
  return NextResponse.json({ ok: true });
}
