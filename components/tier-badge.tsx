import type { AccountTier } from "@/lib/schemas";

const labels: Record<AccountTier, string> = {
  none: "Free",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export function TierBadge({ tier, planId }: { tier: AccountTier; planId?: string }) {
  if (planId === "super_year") {
    return <span className="tier tier-super">Super</span>;
  }
  return <span className={`tier tier-${tier}`}>{labels[tier]}</span>;
}
