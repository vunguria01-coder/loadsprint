import { NextResponse } from "next/server";
import { inviteSchema } from "@/lib/schemas";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { createInvite, getInvitesByRole, deleteInvite } from "@/lib/invites";
import { seatAllowance } from "@/lib/billing-plans";
import { sendEmail, dispatcherInviteEmail } from "@/lib/email";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://loadsprint.us.com";

// Only an OWNER dispatcher (no ownerId) — or admin — may manage seats.
function canManageSeats(me: { role: string; ownerId?: string }) {
  if (me.role === "admin") return true;
  return me.role === "dispatcher" && !me.ownerId;
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (!canManageSeats(me)) {
    return NextResponse.json(
      { ok: false, error: "Only the account owner can add dispatchers." },
      { status: 403 }
    );
  }
  if (me.role === "dispatcher" && !hasAccess(me)) {
    return NextResponse.json(
      { ok: false, error: "Activate a plan first to add dispatchers." },
      { status: 402 }
    );
  }
  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = getInvitesByRole(me.id, "dispatcher");
  const existingEmails = new Set(existing.map((i) => i.email.toLowerCase()));
  const isNew = !existingEmails.has(email);

  // Seat limit (admin unlimited).
  const limit = me.role === "admin" ? Number.MAX_SAFE_INTEGER : seatAllowance(me.planId, me.tier);
  const used = existingEmails.size;
  if (isNew && used >= limit) {
    return NextResponse.json(
      { ok: false, error: `Seat limit reached (${limit}). Upgrade your plan for more dispatcher seats.` },
      { status: 402 }
    );
  }

  const invite = createInvite(email, me.id, me.name, "dispatcher");
  const joinLink = `${SITE_BASE}/dispatcher-join?code=${invite.code}`;

  const mail = dispatcherInviteEmail({ ownerName: me.name, code: invite.code, joinLink });
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });

  return NextResponse.json({
    ok: true,
    invite,
    joinLink,
    limit,
    used: isNew ? used + 1 : used,
    emailed: sent.ok,
    emailSkipped: sent.skipped || false,
  });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (!canManageSeats(me)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await req.json().catch(() => ({ id: "" }));
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const ok = deleteInvite(String(id), me.id, me.role === "admin");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
