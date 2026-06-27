import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { getUserById, updateUser } from "@/lib/auth";

// Stripe calls this after payments. We verify the signature, then grant the
// purchased tier + expiry. Configure STRIPE_WEBHOOK_SECRET in Railway and point
// a Stripe webhook to /api/billing/webhook for these events:
//   checkout.session.completed, invoice.paid, customer.subscription.deleted

function grant(userId: string, tier: string, durationDays: number) {
  const user = getUserById(userId);
  if (!user) return;
  const base = Date.now();
  const expires = new Date(base + durationDays * 24 * 60 * 60 * 1000).toISOString();
  updateUser(userId, { tier: tier as never, tierExpiresAt: expires });
}

function extendOneMonth(userId: string, tier: string) {
  const user = getUserById(userId);
  if (!user) return;
  // Renewal: push expiry one month from the later of now / current expiry.
  const current = user.tierExpiresAt ? new Date(user.tierExpiresAt).getTime() : 0;
  const from = Math.max(Date.now(), current);
  const expires = new Date(from + 30 * 24 * 60 * 60 * 1000).toISOString();
  updateUser(userId, { tier: tier as never, tierExpiresAt: expires });
}

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
      if (userId && tier) grant(userId, tier, durationDays);
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
