import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";
import { getPricing, getLimits } from "@/lib/settings";
import { currentUser } from "@/lib/guard";
import { TIERS, type Tier, type AccountTier } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "Pricing — LoadSprint",
  description: "Silver, Gold, and Platinum plans for brokers and dispatchers.",
};

const features: Record<Tier, string[]> = {
  silver: [
    "Real-time tracking",
    "Documents, photos & chat",
    "Email support",
    "Standard carrier network",
  ],
  gold: [
    "Everything in Silver",
    "Priority dispatch",
    "24/7 phone support",
    "Advanced reporting",
  ],
  platinum: [
    "Everything in Gold",
    "Dedicated account manager",
    "Priority carrier matching",
    "API access & integrations",
  ],
};

export default async function PricingPage() {
  const pricing = getPricing();
  const limits = getLimits();
  const me = await currentUser();
  const current: AccountTier = me?.tier ?? "none";
  const signedIn = !!me;
  const limitFor: Record<Tier, number> = {
    silver: limits.silver,
    gold: limits.gold,
    platinum: limits.platinum,
  };

  return (
    <div className="auth">
      <div className="auth-top">
        <Link href="/" aria-label="LoadSprint home" className="back">
          <ArrowLeft size={16} /> Back to site
        </Link>
        <Link href={signedIn ? "/dashboard" : "/login"} className="back">
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </div>

      <main className="admin-body" style={{ position: "relative", zIndex: 1 }}>
        <div className="wrap">
          <div className="shead center" style={{ marginBottom: 30 }}>
            <span className="eyebrow">Plans</span>
            <h2 className="h2">
              Simple pricing for <span className="grad-text">growing</span>{" "}
              operations
            </h2>
            <p className="lead" style={{ marginInline: "auto" }}>
              Plans are activated by your LoadSprint administrator. Each extra
              driver beyond your plan limit is {pricing.currency}
              {limits.extraDriverPrice}/{pricing.period}.
            </p>
          </div>

          <div className="tiers">
            {TIERS.map((tier) => {
              const featured = tier === "gold";
              return (
                <div
                  key={tier}
                  className={`ptier${featured ? " featured" : ""}${
                    current === tier ? " current" : ""
                  }`}
                >
                  {featured && <span className="pop">Most popular</span>}
                  <span className={`tier tier-${tier}`}>{tier}</span>
                  <div className="pprice">
                    {pricing.currency}
                    {pricing[tier]}
                    <small> /{pricing.period}</small>
                  </div>
                  <ul>
                    <li>
                      <Check strokeWidth={2.4} /> Up to {limitFor[tier]} drivers
                    </li>
                    {features[tier].map((f) => (
                      <li key={f}>
                        <Check strokeWidth={2.4} /> {f}
                      </li>
                    ))}
                  </ul>
                  {current === tier ? (
                    <div className="current-tag">Your current plan</div>
                  ) : signedIn && (me?.role === "dispatcher" || me?.role === "admin") ? (
                    <Link href="/billing" className="btn btn-primary btn-block">
                      Choose {tier}
                    </Link>
                  ) : (
                    <div className="current-tag" style={{ color: "var(--muted-2)" }}>
                      Contact your administrator
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
