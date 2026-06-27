// Canonical billing catalog. Amounts are in USD cents (Stripe works in cents).
// This is the source of truth for the pricing page and the Stripe checkout.
// "subscription" => recurring monthly. "one_time" => single payment that grants
// access for durationDays. tier maps to the AccountTier set on success.

export type BillingMode = "subscription" | "one_time";

export type BillingPlan = {
  id: string; // stable key used in checkout + metadata
  label: string; // shown to the user
  tier: "silver" | "gold" | "platinum"; // account tier granted
  mode: BillingMode;
  amountCents: number;
  drivers: number;
  durationDays?: number; // for one_time plans (how long access lasts)
  blurb: string;
};

export const BILLING_PLANS: BillingPlan[] = [
  // Monthly auto-renewing subscriptions
  { id: "silver_monthly", label: "Silver", tier: "silver", mode: "subscription", amountCents: 1900, drivers: 2, blurb: "2 drivers, billed monthly" },
  { id: "gold_monthly", label: "Gold", tier: "gold", mode: "subscription", amountCents: 5900, drivers: 8, blurb: "8 drivers, billed monthly" },
  { id: "platinum_monthly", label: "Platinum", tier: "platinum", mode: "subscription", amountCents: 19900, drivers: 30, blurb: "30 drivers, billed monthly" },

  // One-time, single month (no auto-renew)
  { id: "silver_once", label: "Silver — 1 month", tier: "silver", mode: "one_time", amountCents: 2500, drivers: 2, durationDays: 30, blurb: "2 drivers, one month, no auto-renew" },
  { id: "gold_once", label: "Gold — 1 month", tier: "gold", mode: "one_time", amountCents: 9000, drivers: 8, durationDays: 30, blurb: "8 drivers, one month, no auto-renew" },
  { id: "platinum_once", label: "Platinum — 1 month", tier: "platinum", mode: "one_time", amountCents: 30000, drivers: 30, durationDays: 30, blurb: "30 drivers, one month, no auto-renew" },
];

export function getPlan(id: string): BillingPlan | undefined {
  return BILLING_PLANS.find((p) => p.id === id);
}

// Driver allowance — the source of truth. Uses the purchased plan first, then a
// hard-coded tier map. Deliberately does NOT read the editable settings.json, so
// a stale saved file can't cap the wrong number.
const TIER_DRIVERS: Record<string, number> = { silver: 2, gold: 8, platinum: 30 };

export function driverAllowance(planId?: string, tier?: string): number {
  if (planId) {
    const p = getPlan(planId);
    if (p) return p.drivers;
  }
  if (tier && tier in TIER_DRIVERS) return TIER_DRIVERS[tier];
  return 0;
}

export function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
