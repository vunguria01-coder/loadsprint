import type { Metadata } from "next";
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

export default async function ProfitPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const ownerId = me.ownerId || me.id;
  const all: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const delivered = all.filter((l) => l.status === "Delivered" || l.status === "Closed");
  const payMap = getDriverPayMap(ownerId);
  const trucks = getTrucksByOwner(ownerId);
  const truckCost = fleetFinance(trucks, all).cost; // operating costs (all-time)

  const revenue = delivered.reduce((s, l) => s + (l.loadRate || 0), 0);
  const driverPay = delivered.reduce(
    (s, l) => s + loadPay(payMap[l.driverEmail.toLowerCase()], l.loadRate || 0),
    0
  );
  const net = revenue - driverPay - truckCost;

  // This month (revenue − driver pay) for a quick trend read.
  const curYM = ym(new Date());
  let mRev = 0;
  let mPay = 0;
  for (const l of delivered) {
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

        {delivered.length === 0 ? (
          <div className="home-empty">
            <p>No delivered loads yet. Your profit appears here as loads are completed.</p>
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
              <div className="table-wrap">
                <table className="rep-table">
                  <thead>
                    <tr>
                      <th>Load</th>
                      <th>Driver</th>
                      <th>Revenue</th>
                      <th>Driver pay</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{r.ref}</div>
                          <div className="px" style={{ fontSize: 12 }}>{r.route}</div>
                        </td>
                        <td>{r.driver}</td>
                        <td>{money(r.rev)}</td>
                        <td>{r.pay > 0 ? money(r.pay) : "—"}</td>
                        <td className={r.margin >= 0 ? "pos" : "neg"}>{money(r.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
