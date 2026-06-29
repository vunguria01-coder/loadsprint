import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, DollarSign, PackageCheck, Package, Receipt } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";

export const metadata: Metadata = {
  title: "Insights — LoadSprint",
  robots: { index: false, follow: false },
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

export default async function InsightsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const all: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const completed = all.filter((l) => l.status === "Delivered" || l.status === "Closed");

  const totalRevenue = completed.reduce((s, l) => s + (l.loadRate || 0), 0);
  const avgPerLoad = completed.length ? totalRevenue / completed.length : 0;

  const now = new Date();
  const ym = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const curYM = ym(now);
  let thisMonth = 0;
  for (const l of completed) {
    if (ym(new Date(l.createdAt)) === curYM) thisMonth += l.loadRate || 0;
  }

  // Revenue by week — last 8 weeks (oldest first).
  const thisWeek = startOfWeek(now);
  const weeks = Array.from({ length: 8 }, (_, idx) => {
    const i = 7 - idx;
    const s = new Date(thisWeek);
    s.setDate(s.getDate() - i * 7);
    return { key: s.getTime(), label: `${s.getMonth() + 1}/${s.getDate()}`, total: 0 };
  });
  for (const l of completed) {
    const ws = startOfWeek(new Date(l.createdAt)).getTime();
    const w = weeks.find((x) => x.key === ws);
    if (w) w.total += l.loadRate || 0;
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.total));

  // By driver.
  const byDriver = new Map<string, { name: string; loads: number; revenue: number }>();
  for (const l of completed) {
    const key = (l.driverEmail || l.driverName || "unknown").toLowerCase();
    const cur = byDriver.get(key) || {
      name: l.driverName || l.driverEmail || "Unknown driver",
      loads: 0,
      revenue: 0,
    };
    cur.loads += 1;
    cur.revenue += l.loadRate || 0;
    byDriver.set(key, cur);
  }
  const drivers = Array.from(byDriver.values()).sort((a, b) => b.revenue - a.revenue);
  const maxDriverRev = Math.max(1, ...drivers.map((d) => d.revenue));

  const kpis = [
    { Icon: DollarSign, val: money(totalRevenue), label: "Total revenue", accent: "sx-emerald" },
    { Icon: Receipt, val: money(thisMonth), label: "This month", accent: "sx-blue" },
    { Icon: PackageCheck, val: String(completed.length), label: "Completed loads", accent: "sx-green" },
    { Icon: Package, val: money(avgPerLoad), label: "Avg / load", accent: "sx-sky" },
  ];

  return (
    <CabinetServer active="insights">
      <div className="wrap home-wrap">
        <div className="shead" style={{ marginBottom: 24 }}>
          <span className="eyebrow">Analytics</span>
          <h2 className="h2">
            <BarChart3 size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            Insights
          </h2>
          <p className="lead">Revenue and performance from your delivered loads.</p>
        </div>

        <div className="home-stats">
          {kpis.map((k) => {
            const Icon = k.Icon;
            return (
              <div className={`home-stat ${k.accent}`} key={k.label}>
                <div className="hs-ic"><Icon size={18} /></div>
                <div className="hs-val">{k.val}</div>
                <div className="hs-label">{k.label}</div>
              </div>
            );
          })}
        </div>

        {completed.length === 0 ? (
          <div className="home-empty">
            <p>No delivered loads yet. Charts appear here as your drivers complete loads.</p>
          </div>
        ) : (
          <>
            <div className="ins-section">
              <h3>Revenue — last 8 weeks</h3>
              <p className="ins-sub">Based on when each completed load was created.</p>
              <div className="ins-card">
                <div className="ins-bars">
                  {weeks.map((w) => (
                    <div className="ins-bar" key={w.key}>
                      <span className="ib-val">{w.total > 0 ? money(w.total) : ""}</span>
                      <div
                        className="ib-fill"
                        style={{ height: `${Math.max(2, (w.total / maxWeek) * 100)}%` }}
                      />
                      <span className="ib-label">{w.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ins-section">
              <h3>By driver</h3>
              <p className="ins-sub">Delivered revenue and load count per driver.</p>
              <div className="ins-card">
                <div className="ins-drv">
                  {drivers.map((d) => (
                    <div className="ins-drv-row" key={d.name}>
                      <div className="ins-drv-top">
                        <span className="ins-drv-name">{d.name}</span>
                        <span className="ins-drv-meta">
                          {d.loads} load{d.loads === 1 ? "" : "s"} ·{" "}
                          <span className="ins-drv-rev">{money(d.revenue)}</span>
                        </span>
                      </div>
                      <div className="ins-track">
                        <div
                          className="it-fill"
                          style={{ width: `${Math.max(3, (d.revenue / maxDriverRev) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {(me.commissionPct || 0) > 0 && (
              <p className="ins-foot">
                Your commission is {me.commissionPct}% — that&apos;s{" "}
                <strong>{money((totalRevenue * (me.commissionPct || 0)) / 100)}</strong> earned from
                delivered loads.
              </p>
            )}
          </>
        )}
      </div>
    </CabinetServer>
  );
}
