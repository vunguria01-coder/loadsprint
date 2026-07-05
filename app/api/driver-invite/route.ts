import { NextResponse } from "next/server";
import { inviteSchema } from "@/lib/schemas";
import { currentUser } from "@/lib/guard";
import { hasAccess, billingUser } from "@/lib/auth";
import { createInvite, getInvitesByRole, deleteInvite } from "@/lib/invites";
import { getLimits } from "@/lib/settings";
import { driverAllowance } from "@/lib/billing-plans";
import { sendEmail, driverInviteEmail } from "@/lib/email";

const APP_BASE = process.env.DRIVER_APP_URL || "https://loadsprint.app/driver";
// Apple App Store page for the LoadSprint Driver app. Overridable via env.
const APP_STORE_URL =
  process.env.IOS_APP_STORE_URL || "https://apps.apple.com/app/id6785073294";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  // Dispatchers need an active plan to add drivers (admin is exempt).
  if (me.role === "dispatcher" && !hasAccess(me)) {
    return NextResponse.json(
      { ok: false, error: "Activate a plan first to add drivers." },
      { status: 402 }
    );
  }
  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existingEmails = new Set(
    getInvitesByRole(me.id, "driver").map((i) => i.email.toLowerCase())
  );
  const isNewDriver = !existingEmails.has(email);
  const bu = billingUser(me);
  const limit = me.role === "admin" ? Number.MAX_SAFE_INTEGER : driverAllowance(bu.planId, bu.tier);
  // position this driver would occupy among distinct drivers
  const position = isNewDriver ? existingEmails.size + 1 : existingEmails.size;
  const extra = isNewDriver && position > limit;
  const extraPrice = getLimits().extraDriverPrice;

  const invite = createInvite(email, me.id, me.name);
  const appLink = `${APP_BASE}?code=${invite.code}`;

  // Email the join code to the driver (skipped silently if email isn't configured).
  const mail = driverInviteEmail({ dispatcherName: me.name, code: invite.code, appStoreUrl: APP_STORE_URL });
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });

  return NextResponse.json({
    ok: true,
    invite,
    appLink,
    limit,
    used: position,
    extra,
    extraPrice,
    emailed: sent.ok,
    emailSkipped: sent.skipped || false,
  });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
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
