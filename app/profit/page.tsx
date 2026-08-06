import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, DollarSign, Wallet, Truck as TruckIcon } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import { getDriverPayMap, type DriverPay } from "@/lib/driver-pay";
import { getTrucksByOwner, fleetFinance } from "@/lib/trucks";
import { money } from "@/lib/format";
import { CabinetServer } from "@/components/cabinet-server";
import { Receivables, type Receivable } from "@/components/receivables";
import { ProfitTable } from "@/components/profit-table";

export const metadata: Metadata = {
  title: "Profit — LoadSprint",
  robots: { index: false, follow: false },
};

// Per-load driver pay from the dispatcher's pay rule (matches Settlements).
function loadPay(pay: DriverPay | undefined, loadRate: number): number {
  if (!pay || !pay.rate || pay.rate <= 0) return 0;
  return pay.type === "pct" ? (loadRate * pay.rate) / 100 : pay.rate;
}

const ym = (d: Date) => d.getFullYear() * 12 + d.getMonth();

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam) || RANGES[3];

  const ownerId = me.ownerId || me.id;
  const all: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const everDelivered = all.filter((l) => l.status === "Delivered" || l.status === "Closed");
  const cutoff = range.days == null ? null : Date.now() - range.days * 86_400_000;
  const delivered = cutoff == null ? everDelivered : everDelivered.filter((l) => new Date(l.createdAt).getTime() >= cutoff);
  const payMap = getDriverPayMap(ownerId);
  const trucks = getTrucksByOwner(ownerId);
  const truckCost = fleetFinance(trucks, all).cost; // operating costs (all-time, not affected by the period filter)

  const revenue = delivered.reduce((s, l) => s + (l.loadRate || 0), 0);
  const driverPay = delivered.reduce(
    (s, l) => s + loadPay(payMap[l.driverEmail.toLowerCase()], l.loadRate || 0),
    0
  );
  const net = revenue - driverPay - truckCost;

  // This month (revenue − driver pay) for a quick trend read — always the
  // current calendar month, independent of the period filter above.
  const curYM = ym(new Date());
  let mRev = 0;
  let mPay = 0;
  for (const l of everDelivered) {
    if (ym(new Date(l.createdAt)) === curYM) {
      mRev += l.loadRate || 0;
      mPay += loadPay(payMap[l.driverEmail.toLowerCase()], l.loadRate || 0);
    }
  }

  // Per-load margin rows (newest first).
  const rows = delivered
    .map((l) => {
      const rev = l.loadRate || 0;
      const pay = loadPay(payMap[l.driverEmail.toLowerCase()], rev);
      return {
        id: l.id,
        ref: l.ref,
        driver: l.driverName || l.driverEmail,
        route: `${l.originName} → ${l.destName}`,
        rev,
        pay,
        margin: rev - pay,
        createdAt: l.createdAt,
        search: [l.ref, l.driverName, l.driverEmail, l.originName, l.destName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Receivables: delivered loads the broker hasn't paid for yet.
  const receivables: Receivable[] = delivered
    .filter((l) => !l.brokerPaid)
    .map((l) => ({
      id: l.id,
      ref: l.ref,
      broker: l.brokerName || l.brokerEmail || "—",
      route: `${l.originName} → ${l.destName}`,
      amount: l.loadRate || 0,
      since: l.deliveredAt || l.createdAt,
    }))
    .sort((a, b) => (a.since < b.since ? 1 : -1));

  const tiles = [
    { Icon: DollarSign, val: money(revenue), label: "Revenue", accent: "sx-green" },
    { Icon: Wallet, val: money(driverPay), label: "Driver pay", accent: "sx-blue" },
    { Icon: TruckIcon, val: money(truckCost), label: "Truck costs", accent: "sx-sky" },
    { Icon: TrendingUp, val: money(net), label: "Net profit", accent: net >= 0 ? "sx-emerald" : "sx-red" },
  ];

  return (
    <CabinetServer active="profit">
      <div className="wrap home-wrap">
        <div className="shead" style={{ marginBottom: 22 }}>
          <span className="eyebrow">Money</span>
          <h2 className="h2">
            <TrendingUp size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            Profit &amp; loss
          </h2>
          <p className="lead">
            Real net: what your delivered loads earned, minus driver pay and truck operating costs.
          </p>
        </div>

        <div className="ins-range">
          <div className="ins-range-tabs">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={r.key === "all" ? "/profit" : `/profit?range=${r.key}`}
                className={`ins-range-item${r.key === range.key ? " active" : ""}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>

        {delivered.length === 0 ? (
          <div className="home-empty">
            {everDelivered.length === 0 ? (
              <p>No delivered loads yet. Your profit appears here as loads are completed.</p>
            ) : (
              <>
                <p>No delivered loads in the last {range.label.toLowerCase()}.</p>
                <Link href="/profit" className="home-empty-link">Show all time</Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="home-stats">
              {tiles.map((t) => {
                const Icon = t.Icon;
                return (
                  <div className={`home-stat ${t.accent}`} key={t.label}>
                    <div className="hs-ic"><Icon size={18} /></div>
                    <div className="hs-val">{t.val}</div>
                    <div className="hs-label">{t.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="pnl-bar">
              <span>This month: <b>{money(mRev - mPay)}</b> margin</span>
              <span className="pnl-sub">{money(mRev)} revenue − {money(mPay)} driver pay</span>
            </div>

            <div className="ins-section">
              <h3>Profit by load</h3>
              <p className="ins-sub">Margin = load revenue − driver pay. Truck costs apply to the fleet total above.</p>
              <ProfitTable rows={rows} rangeLabel={range.label} />
              {driverPay === 0 && (
                <p className="px" style={{ marginTop: 12 }}>
                  Tip: set each driver&apos;s pay in <b>Settlements</b> so margins reflect real payouts.
                </p>
              )}
            </div>

            <Receivables items={receivables} />
          </>
        )}
      </div>
    </CabinetServer>
  );
}
