import Link from "next/link";
import {
  Users,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  User,
  BadgeDollarSign,
} from "lucide-react";
import type { SafeUser } from "@/lib/auth";
import type { AccountTier, PricingValues } from "@/lib/schemas";

const DAY = 86400000;
/** Anything at or under this many days left counts as "expiring soon". */
const SOON_DAYS = 7;

/** How many attention rows to render before collapsing the rest into a count. */
const ATTENTION_LIMIT = 6;

type Status = "free" | "active" | "soon" | "expired";

function daysLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY);
}

// Same buckets the account manager filters by, so the tiles and the list below
// it never disagree about what "expiring" means.
function statusOf(u: SafeUser): Status {
  if (u.tier === "none") return "free";
  const left = daysLeft(u.tierExpiresAt);
  if (left === null) return "active";
  if (left < 0) return "expired";
  return left <= SOON_DAYS ? "soon" : "active";
}

function planName(tier: AccountTier): string {
  if (tier === "none") return "Free";
  return tier[0].toUpperCase() + tier.slice(1);
}

function priceOf(tier: AccountTier, pricing: PricingValues): number {
  if (tier === "silver") return pricing.silver;
  if (tier === "gold") return pricing.gold;
  if (tier === "platinum") return pricing.platinum;
  return 0;
}

function money(n: number, currency: string): string {
  return currency + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function attentionLine(u: SafeUser): string {
  const left = daysLeft(u.tierExpiresAt);
  if (left === null) return "No expiry";
  if (left < 0) return `Expired ${-left} day${left === -1 ? "" : "s"} ago`;
  if (left === 0) return "Expires today";
  return `${left} day${left === 1 ? "" : "s"} left`;
}

/**
 * Read-only snapshot of the subscriber base: headline counts, what those plans
 * are worth per month, and the accounts an admin has to act on today.
 */
export function AdminOverview({
  users,
  pricing,
}: {
  users: SafeUser[];
  pricing: PricingValues;
}) {
  const counts: Record<Status, number> = { free: 0, active: 0, soon: 0, expired: 0 };
  // Paying accounts per tier — expired plans bring in nothing, so they are out.
  const paidByTier: Record<string, number> = { silver: 0, gold: 0, platinum: 0 };
  const attention: SafeUser[] = [];

  for (const u of users) {
    const status = statusOf(u);
    counts[status]++;
    if (status === "active" || status === "soon") paidByTier[u.tier]++;
    if (status === "soon" || status === "expired") attention.push(u);
  }

  const mrr =
    paidByTier.silver * pricing.silver +
    paidByTier.gold * pricing.gold +
    paidByTier.platinum * pricing.platinum;
  const paying = paidByTier.silver + paidByTier.gold + paidByTier.platinum;

  // Expired first (already lost), then whatever runs out soonest.
  attention.sort(
    (a, b) => (daysLeft(a.tierExpiresAt) ?? 0) - (daysLeft(b.tierExpiresAt) ?? 0)
  );
  const shown = attention.slice(0, ATTENTION_LIMIT);
  const hidden = attention.length - shown.length;

  const tiles = [
    { key: "all", label: "Total accounts", value: users.length, icon: Users },
    { key: "active", label: "Active", value: counts.active, icon: CheckCircle2 },
    {
      key: "soon",
      label: `Expiring ≤${SOON_DAYS}d`,
      value: counts.soon,
      icon: CalendarClock,
    },
    { key: "expired", label: "Expired", value: counts.expired, icon: AlertTriangle },
    { key: "free", label: "Free", value: counts.free, icon: User },
  ];

  return (
    <div className="ov">
      <div className="ov-tiles">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.key} className={`ov-tile ov-${t.key}`}>
              <span className="ov-ico" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="ov-num">{t.value}</span>
              <span className="ov-lbl">{t.label}</span>
            </div>
          );
        })}

        <div className="ov-tile ov-mrr">
          <span className="ov-ico" aria-hidden="true">
            <BadgeDollarSign size={16} />
          </span>
          <span className="ov-num">{money(mrr, pricing.currency)}</span>
          <span className="ov-lbl">MRR · {paying} paying</span>
        </div>
      </div>

      <p className="ov-break">
        {(["silver", "gold", "platinum"] as const).map((tier) => (
          <span key={tier} className={`ov-chip tier-${tier}`}>
            {planName(tier)}
            <b>{paidByTier[tier]}</b>
            <i>
              × {money(priceOf(tier, pricing), pricing.currency)}/{pricing.period}
            </i>
          </span>
        ))}
        <span className="ov-note">Expired plans are not counted.</span>
      </p>

      <div className="ov-att">
        <span className="ov-att-cap">Needs attention</span>
        {attention.length === 0 ? (
          <p className="ov-att-empty">
            Nothing expiring in the next {SOON_DAYS} days and no expired plans.
          </p>
        ) : (
          <>
            <ul className="ov-att-list">
              {shown.map((u) => {
                const status = statusOf(u);
                return (
                  <li key={u.id} className={`ov-att-row st-${status}`}>
                    <span className="ov-att-id">
                      <b>{u.name}</b>
                      <i>{u.email}</i>
                    </span>
                    <span className={`ov-att-tier tier-${u.tier}`}>{planName(u.tier)}</span>
                    <span className="ov-att-when">{attentionLine(u)}</span>
                  </li>
                );
              })}
            </ul>
            {hidden > 0 && (
              <p className="ov-att-more">
                +{hidden} more account{hidden === 1 ? "" : "s"} —{" "}
                <Link href="#accounts">see all accounts</Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
