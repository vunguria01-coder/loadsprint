import type { AccountTier } from "@/lib/schemas";

const labels: Record<AccountTier, string> = {
  none: "Free",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export function TierBadge({ tier }: { tier: AccountTier }) {
  return <span className={`tier tier-${tier}`}>{labels[tier]}</span>;
}
