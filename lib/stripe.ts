import crypto from "crypto";
import type { BillingPlan } from "@/lib/billing-plans";

// Stripe via REST (no SDK dependency). Configure on the server:
//   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET  — whsec_... (from the webhook endpoint settings)

const API = "https://api.stripe.com/v1";

// Encode a nested object into Stripe's bracketed x-www-form-urlencoded format.
function encodeForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") {
      parts.push(encodeForm(value as Record<string, unknown>, k));
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export async function createCheckoutSession(opts: {
  plan: BillingPlan;
  userId: string;
  email: string;
  baseUrl: string;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, error: "Payments are not configured yet." };

  const { plan, userId, email, baseUrl } = opts;
  const isSub = plan.mode === "subscription";

  const body: Record<string, unknown> = {
    mode: isSub ? "subscription" : "payment",
    success_url: `${baseUrl}/billing?status=success`,
    cancel_url: `${baseUrl}/billing?status=cancel`,
    client_reference_id: userId,
    customer_email: email,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": plan.amountCents,
    "line_items[0][price_data][product_data][name]": `LoadSprint ${plan.label}`,
    "metadata[planId]": plan.id,
    "metadata[userId]": userId,
    "metadata[tier]": plan.tier,
    "metadata[durationDays]": String(plan.durationDays || 30),
  };
  if (isSub) {
    body["line_items[0][price_data][recurring][interval]"] = "month";
    // Carry metadata onto the subscription so renewal invoices identify the user.
    body["subscription_data[metadata][userId]"] = userId;
    body["subscription_data[metadata][tier]"] = plan.tier;
    body["subscription_data[metadata][planId]"] = plan.id;
  }

  try {
    const res = await fetch(`${API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodeForm(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message || "Stripe error" };
    return { ok: true, url: data.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Verify a Stripe webhook signature and return the parsed event, or null.
export function verifyWebhook(
  rawBody: string,
  sigHeader: string | null
): Record<string, unknown> | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return null;

  // Header looks like: t=1690000000,v1=hexsignature[,v1=...]
  const parts = sigHeader.split(",").reduce<Record<string, string[]>>((acc, kv) => {
    const [k, v] = kv.split("=");
    if (!k || !v) return acc;
    (acc[k] = acc[k] || []).push(v);
    return acc;
  }, {});
  const t = parts["t"]?.[0];
  const sigs = parts["v1"] || [];
  if (!t || sigs.length === 0) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  const ok = sigs.some((s) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
    } catch {
      return false;
    }
  });
  if (!ok) return null;

  // Reject events older than 5 minutes (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > 300) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
