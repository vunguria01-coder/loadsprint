"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { BILLING_PLANS, fmtUsd, type BillingPlan } from "@/lib/billing-plans";

function PlanCard({ plan, busy, onBuy }: { plan: BillingPlan; busy: string | null; onBuy: (id: string) => void }) {
  const isBusy = busy === plan.id;
  return (
    <div className="plan-card">
      <div className="plan-name">{plan.label}</div>
      <div className="plan-price">
        {fmtUsd(plan.amountCents)}
        <span>
          {plan.mode === "subscription" ? "/mo" : " once"}
        </span>
      </div>
      <ul className="plan-feats">
        <li><Check size={15} /> {plan.drivers} drivers</li>
        <li><Check size={15} /> {plan.mode === "subscription" ? "Auto-renews monthly" : "One month, no auto-renew"}</li>
        <li><Check size={15} /> All dispatcher features</li>
      </ul>
      <button type="button" className="plan-btn" disabled={!!busy} onClick={() => onBuy(plan.id)}>
        {isBusy ? "Opening checkout…" : plan.mode === "subscription" ? "Subscribe" : "Buy"}
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
      // Reload without the session_id so server components re-render with the new
      // plan, and the confirm effect doesn't run again.
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

  const monthly = BILLING_PLANS.filter((p) => p.mode === "subscription");
  const once = BILLING_PLANS.filter((p) => p.mode === "one_time" && p.durationDays === 30);

  return (
    <div className="billing-wrap">
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

      <h3 className="billing-h">Monthly subscription</h3>
      <p className="billing-sub">Billed automatically every month. Cancel anytime.</p>
      <div className="plan-grid">
        {monthly.map((p) => <PlanCard key={p.id} plan={p} busy={busy} onBuy={buy} />)}
      </div>

      <h3 className="billing-h">Pay for one month</h3>
      <p className="billing-sub">A single payment for one month. No auto-renew.</p>
      <div className="plan-grid">
        {once.map((p) => <PlanCard key={p.id} plan={p} busy={busy} onBuy={buy} />)}
      </div>

      <p className="billing-note">
        Payments are processed securely by Stripe. Apple Pay, Google Pay and cards are supported.
        Extra drivers beyond your plan limit are $10/mo each.
      </p>
    </div>
  );
}
