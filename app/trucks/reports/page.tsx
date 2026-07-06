import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ArrowLeft, DollarSign, Wallet, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import {
  getTrucksByOwner,
  fleetFinance,
  monthlyReport,
  yearlyReport,
} from "@/lib/trucks";
import { EXPENSE_KINDS, EXPENSE_LABELS } from "@/lib/truck-constants";
import { money } from "@/lib/format";
import { CabinetServer } from "@/components/cabinet-server";

export const metadata: Metadata = {
  title: "Truck reports — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function TruckReportsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const ownerId = me.ownerId || me.id;
  const trucks = getTrucksByOwner(ownerId);
  const loads: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);

  const now = new Date();
  const fleet = fleetFinance(trucks, loads);
  const months = monthlyReport(trucks, loads, now, 12);
  const years = yearlyReport(trucks, loads, now, 3);
  const maxMonthCost = Math.max(1, ...months.map((m) => m.cost));

  // All-time OPERATING spend by category (ranked bars) — capital purchase excluded.
  const byKind = EXPENSE_KINDS.filter((k) => k !== "purchase")
    .map((k) => ({ kind: k, total: fleet.byKind[k] }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxKind = Math.max(1, ...byKind.map((k) => k.total));

  const tiles = [
    { Icon: Wallet, val: money(fleet.invested), label: "Invested", accent: "sx-sky" },
    { Icon: Wallet, val: money(fleet.cost), label: "Operating cost", accent: "sx-blue" },
    { Icon: DollarSign, val: money(fleet.income), label: "Income", accent: "sx-green" },
    { Icon: TrendingUp, val: money(fleet.net), label: "Net profit", accent: fleet.net >= 0 ? "sx-emerald" : "sx-red" },
  ];

  return (
    <CabinetServer active="trucks">
      <div className="wrap home-wrap">
        <div style={{ marginBottom: 8 }}>
          <Link href="/trucks" className="btn btn-ghost btn-sm">
            <ArrowLeft size={15} /> Back to trucks
          </Link>
        </div>
        <div className="shead" style={{ marginBottom: 22 }}>
          <span className="eyebrow">Fleet reports</span>
          <h2 className="h2">
            <BarChart3 size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            Truck reports
          </h2>
          <p className="lead">Cost, income and profit across your fleet — by month and by year.</p>
        </div>

        {trucks.length === 0 ? (
          <div className="home-empty">
            <p>No trucks yet. <Link className="home-empty-link" href="/trucks">Add a truck</Link> to start seeing reports.</p>
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

            <div className="ins-section">
              <h3>Cost — last 12 months</h3>
              <p className="ins-sub">Every logged expense bucketed by its date.</p>
              <div className="ins-card">
                <div className="ins-bars">
                  {months.map((m) => (
                    <div className="ins-bar" key={m.key}>
                      <span className="ib-val">{m.cost > 0 ? money(m.cost) : ""}</span>
                      <div className="ib-fill" style={{ height: `${Math.max(2, (m.cost / maxMonthCost) * 100)}%` }} />
                      <span className="ib-label">{m.label.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {byKind.length > 0 && (
              <div className="ins-section">
                <h3>Spending by category</h3>
                <p className="ins-sub">All-time totals across the fleet.</p>
                <div className="ins-card">
                  <div className="ins-drv">
                    {byKind.map((k) => (
                      <div className="ins-drv-row" key={k.kind}>
                        <div className="ins-drv-top">
                          <span className="ins-drv-name">{EXPENSE_LABELS[k.kind]}</span>
                          <span className="ins-drv-meta">
                            <span className="ins-drv-rev">{money(k.total)}</span>
                          </span>
                        </div>
                        <div className="ins-track">
                          <div className="it-fill" style={{ width: `${Math.max(3, (k.total / maxKind) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="ins-section">
              <h3>By year</h3>
              <p className="ins-sub">Cost vs income, and the resulting profit.</p>
              <div className="table-wrap">
                <table className="rep-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Cost</th>
                      <th>Income</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y) => (
                      <tr key={y.key}>
                        <td>{y.label}</td>
                        <td>{money(y.cost)}</td>
                        <td>{money(y.income)}</td>
                        <td className={y.net >= 0 ? "pos" : "neg"}>{money(y.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </CabinetServer>
  );
}
