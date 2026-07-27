import { NextResponse } from "next/server";
import { adminAccountSchema } from "@/lib/schemas";
import { updateUser, toSafe, type User } from "@/lib/auth";
import { currentUser } from "@/lib/guard";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = adminAccountSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { userId, tier, days, planId, canFreezeLocation, canConfirmationPdf } = parsed.data;
  // Typed as Partial<User>, not Record<string, unknown>: the patch is merged
  // straight into the stored row, so a key that isn't a real column (or a grant
  // spelled wrong) must fail the build rather than silently write a dead field.
  // Only fields the request actually sent are assigned — untouched grants stay.
  const patch: Partial<User> = {};
  if (tier !== undefined) {
    patch.tier = tier;
    if (tier === "none") {
      // revoking a plan clears any expiry
      patch.tierExpiresAt = undefined;
    }
  }
  // planId: "" clears it back to a plain tier.
  if (planId !== undefined) {
    patch.planId = planId || undefined;
  }
  // days: 0 = no expiry (open-ended); >0 = expires N days from now
  if (days !== undefined && (tier === undefined || tier !== "none")) {
    patch.tierExpiresAt =
      days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
  }
  if (canFreezeLocation !== undefined) patch.canFreezeLocation = canFreezeLocation;
  if (canConfirmationPdf !== undefined) patch.canConfirmationPdf = canConfirmationPdf;
  const updated = updateUser(userId, patch);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, user: toSafe(updated) });
}
