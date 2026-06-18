import { NextResponse } from "next/server";
import { inviteSchema } from "@/lib/schemas";
import { currentUser } from "@/lib/guard";
import { hasActiveSub } from "@/lib/auth";
import { createInvite, getInvitesBy } from "@/lib/invites";
import { driverLimitForTier, getLimits } from "@/lib/settings";

const APP_BASE = process.env.DRIVER_APP_URL || "https://loadsprint.app/driver";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  // Dispatchers need an active plan to add drivers (admin is exempt).
  if (me.role === "dispatcher" && !hasActiveSub(me)) {
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
    getInvitesBy(me.id).map((i) => i.email.toLowerCase())
  );
  const isNewDriver = !existingEmails.has(email);
  const limit = me.role === "admin" ? Number.MAX_SAFE_INTEGER : driverLimitForTier(me.tier);
  // position this driver would occupy among distinct drivers
  const position = isNewDriver ? existingEmails.size + 1 : existingEmails.size;
  const extra = isNewDriver && position > limit;
  const extraPrice = getLimits().extraDriverPrice;

  const invite = createInvite(email, me.id, me.name);
  const appLink = `${APP_BASE}?code=${invite.code}`;
  return NextResponse.json({
    ok: true,
    invite,
    appLink,
    limit,
    used: position,
    extra,
    extraPrice,
  });
}
