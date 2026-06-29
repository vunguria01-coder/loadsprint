import { Check } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { BILLING_PLANS, fmtUsd, seatAllowance } from "@/lib/billing-plans";

// A short, benefit-led line-up per tier (kept tight on purpose).
const tierFeatures: Record<string, string[]> = {
  silver: ["AI rate-con import & invoices", "Live GPS + broker packets", "Driver mobile app"],
  gold: ["Everything in Silver", "Priority email support", "More room to grow"],
  platinum: ["Everything in Gold", "Built for growing fleets", "Most drivers & seats"],
};

export function PricingHome() {
  const monthly = BILLING_PLANS.filter((p) => p.mode === "subscription");
  return (
    <section className="section" id="pricing">
      <div className="wrap">
        <Reveal className="shead">
          <span className="eyebrow">Pricing</span>
          <h2 className="h2">
            Simple plans, <span className="grad-text">priced upfront</span>
          </h2>
          <p className="lead">
            Pick a plan by how many drivers you run. No setup fees — cancel anytime.
          </p>
        </Reveal>

        <div className="plan-grid lp-plans">
          {monthly.map((p) => {
            const seats = seatAllowance(p.id);
            const pop = p.tier === "gold";
            return (
              <div key={p.id} className={`plan-card${pop ? " pop" : ""}`}>
                {pop && <span className="plan-pop">Most popular</span>}
                <span className={`tier tier-${p.tier}`}>{p.label}</span>
                <div className="plan-price">
                  {fmtUsd(p.amountCents)}
                  <span>/mo</span>
                </div>
                <ul className="plan-feats">
                  <li>
                    <Check size={16} /> {p.drivers} drivers
                  </li>
                  <li>
                    <Check size={16} /> {seats} sub-dispatcher{seats === 1 ? "" : "s"}
                  </li>
                  {tierFeatures[p.tier].map((f) => (
                    <li key={f}>
                      <Check size={16} /> {f}
                    </li>
                  ))}
                </ul>
                <a href="/register" className="plan-btn lp-plan-btn">
                  Get started
                </a>
              </div>
            );
          })}
        </div>

        <p className="lp-note">
          Need just one month? One-time plans from {fmtUsd(2500)} — no auto-renew.{" "}
          <a href="/pricing">See full pricing →</a>
        </p>
      </div>
    </section>
  );
}
