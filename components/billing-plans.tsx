"use client";

import { useState, useEffect } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { BILLING_PLANS, fmtUsd, type BillingPlan } from "@/lib/billing-plans";

type Mode = "subscription" | "one_time";

const TIER_META: Record<string, { tagline: string; accent: string; popular?: boolean }> = {
  silver: { tagline: "For owner-operators getting started", accent: "silver" },
  gold: { tagline: "For growing dispatch teams", accent: "gold", popular: true },
  platinum: { tagline: "For high-volume operations", accent: "platinum" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function included(plan: BillingPlan): string[] {
  return [
    "Live GPS tracking & ETA",
    "AI rate-con reading & invoices",
    "Broker tracking portal",
    "Documents, photos & chat",
    plan.mode === "subscription" ? "Cancel anytime" : "No auto-renew",
  ];
}

function PriceCard({
  plan,
  busy,
  onBuy,
}: {
  plan: BillingPlan;
  busy: string | null;
  onBuy: (id: string) => void;
}) {
  const meta = TIER_META[plan.tier] || { tagline: "", accent: "silver" };
  const isBusy = busy === plan.id;
  const title = cap(plan.tier);
  return (
    <div className={`pricing-card tier-${meta.accent}${meta.popular ? " is-popular" : ""}`}>
      {meta.popular && <div className="pricing-ribbon">Most popular</div>}
      <div className="pricing-tier">{title}</div>
      <div className="pricing-tagline">{meta.tagline}</div>
      <div className="pricing-amount">
        {fmtUsd(plan.amountCents)}
        <span>{plan.mode === "subscription" ? "/mo" : " once"}</span>
      </div>
      <div className="pricing-drivers">Up to {plan.drivers} drivers</div>
      <ul className="pricing-feats">
        {included(plan).map((f, i) => (
          <li key={i}>
            <Check size={15} /> {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="pricing-cta"
        disabled={!!busy}
        onClick={() => onBuy(plan.id)}
      >
        {isBusy
          ? "Opening checkout…"
          : plan.mode === "subscription"
          ? `Get ${title}`
          : `Buy ${title}`}
      </button>
    </div>
  );
}

export function BillingPlansView({
  status,
  sessionId,
}: {
  status?: string;
  sessionId?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("subscription");
  const [confirming] = useState(status === "success" && !!sessionId);

  // When returning from Stripe Checkout, confirm the payment server-side so the
  // tier + expiry are set immediately (does not wait on the webhook).
  useEffect(() => {
    if (status !== "success" || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        await res.json().catch(() => ({}));
      } catch {
        /* webhook will catch up */
      }
      if (cancelled) return;
      window.location.replace("/billing?status=success");
    })();
    return () => {
      cancelled = true;
    };
  }, [status, sessionId]);

  async function buy(planId: string) {
    setBusy(planId);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const d = await res.json();
      if (d.ok && d.url) {
        window.location.href = d.url; // go to Stripe Checkout
      } else {
        setError(d.error || "Could not start checkout.");
        setBusy(null);
      }
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  const plans = BILLING_PLANS.filter(
    (p) => p.mode === mode && (mode === "subscription" || p.durationDays === 30)
  );

  return (
    <div className="pricing-wrap">
      {status === "success" && (
        <div className="billing-banner ok">
          {confirming
            ? "Payment received — activating your plan…"
            : "Payment received — your plan is now active. It may take a few seconds to reflect."}
        </div>
      )}
      {status === "cancel" && (
        <div className="billing-banner">Checkout cancelled — no charge was made.</div>
      )}
      {error && <div className="billing-banner err">{error}</div>}

      <div className="pricing-head">
        <h3>Choose your plan</h3>
        <p>Every feature is included on every plan — just pick the driver capacity you need.</p>
        <div className="pricing-toggle" role="tablist" aria-label="Billing period">
          <button
            type="button"
            className={mode === "subscription" ? "on" : ""}
            onClick={() => setMode("subscription")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={mode === "one_time" ? "on" : ""}
            onClick={() => setMode("one_time")}
          >
            One month
          </button>
        </div>
        <div className="pricing-period-note">
          {mode === "subscription"
            ? "Billed automatically every month · cancel anytime"
            : "A single payment for one month · no auto-renew"}
        </div>
      </div>

      <div className="pricing-grid">
        {plans.map((p) => (
          <PriceCard key={p.id} plan={p} busy={busy} onBuy={buy} />
        ))}
      </div>

      <p className="pricing-trust">
        <ShieldCheck size={15} />
        Secure checkout by Stripe · Apple Pay, Google Pay &amp; cards accepted · Extra drivers are
        $10/mo each
      </p>
    </div>
  );
}
