import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { grantTier, extendOneMonth } from "@/lib/billing-grant";

// Stripe calls this after payments. We verify the signature, then grant the
// purchased tier + expiry. Configure STRIPE_WEBHOOK_SECRET in Railway and point
// a Stripe webhook to /api/billing/webhook for these events:
//   checkout.session.completed, invoice.paid, customer.subscription.deleted

export async function POST(req: Request) {
  const raw = await req.text();
  const event = verifyWebhook(raw, req.headers.get("stripe-signature"));
  if (!event) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 400 });
  }

  const type = String(event.type || "");
  const obj = (event.data as { object?: Record<string, unknown> })?.object || {};
  const meta = (obj.metadata as Record<string, string>) || {};

  try {
    if (type === "checkout.session.completed") {
      // Initial purchase (subscription or one-time).
      const userId = meta.userId || String(obj.client_reference_id || "");
      const tier = meta.tier;
      const durationDays = Number(meta.durationDays) || 30;
      const email =
        String(obj.customer_email || "") ||
        String((obj.customer_details as { email?: string })?.email || "");
      if (tier) grantTier(userId, tier, durationDays, meta.planId, email);
    } else if (type === "invoice.paid") {
      // Monthly subscription renewal — extend access another month.
      const sub = (obj.subscription_details as { metadata?: Record<string, string> })?.metadata || {};
      const userId = sub.userId || meta.userId;
      const tier = sub.tier || meta.tier;
      if (userId && tier) extendOneMonth(userId, tier);
    } else if (type === "customer.subscription.deleted") {
      // Subscription cancelled — let access lapse at the current expiry (no action
      // needed; hasActiveSub will return false once tierExpiresAt passes).
    }
  } catch {
    // Never 500 a webhook for app-side issues; acknowledge so Stripe doesn't retry forever.
  }

  return NextResponse.json({ received: true });
}
