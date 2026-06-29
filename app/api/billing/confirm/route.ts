import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getCheckoutSession } from "@/lib/stripe";
import { getPlan } from "@/lib/billing-plans";
import { grantTier } from "@/lib/billing-grant";

// Called by the billing page when the user returns from Stripe Checkout with a
// session_id. We ask Stripe whether that session was actually paid and, if so,
// grant the tier + expiry right away — a reliable backstop in case the webhook
// is delayed or not configured. Only the buyer can confirm their own session.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing session." }, { status: 400 });
  }

  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Could not verify the payment." }, { status: 502 });
  }

  // Must be a completed, paid checkout.
  const paymentStatus = String(session.payment_status || "");
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    return NextResponse.json({ ok: false, error: "Payment not completed yet." }, { status: 409 });
  }

  // Security: this session must belong to the signed-in user.
  const meta = (session.metadata as Record<string, string>) || {};
  const sessionUserId = meta.userId || String(session.client_reference_id || "");
  if (sessionUserId && sessionUserId !== me.id) {
    return NextResponse.json({ ok: false, error: "This payment is for a different account." }, { status: 403 });
  }

  // Freshness: only confirm a recently-created session (avoids re-granting if an
  // old success URL is reopened later). Grant is absolute, but this is belt-and-braces.
  const created = Number(session.created || 0);
  if (created && Math.abs(Date.now() / 1000 - created) > 60 * 60 * 2) {
    return NextResponse.json({ ok: false, error: "This checkout link has expired." }, { status: 410 });
  }

  // Server-side source of truth for tier + duration (don't trust client metadata).
  const plan = getPlan(meta.planId || "");
  const tier = plan?.tier || meta.tier;
  const durationDays = plan?.durationDays || Number(meta.durationDays) || 30;
  if (!tier) {
    return NextResponse.json({ ok: false, error: "Unknown plan on this payment." }, { status: 400 });
  }

  const updated = grantTier(me.id, tier, durationDays, plan?.id || meta.planId, me.email);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Could not activate the plan." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tier: updated.tier,
    expiresAt: updated.tierExpiresAt,
  });
}
