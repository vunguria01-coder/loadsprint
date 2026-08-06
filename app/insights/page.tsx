import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, DollarSign, PackageCheck, Package, Receipt, Info } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";
import { InsightsExport } from "@/components/insights-export";

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

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

export default async function InsightsPage({
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

  const all: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const everCompleted = all.filter((l) => l.status === "Delivered" || l.status === "Closed");
  const cutoff = range.days == null ? null : Date.now() - range.days * 86_400_000;
  const completed = cutoff == null ? everCompleted : everCompleted.filter((l) => new Date(l.createdAt).getTime() >= cutoff);

  const totalRevenue = completed.reduce((s, l) => s + (l.loadRate || 0), 0);
  const avgPerLoad = completed.length ? totalRevenue / completed.length : 0;

  // Change vs. the immediately preceding period of the same length — only
  // meaningful for a fixed window (7/30/90 days), not "All time".
  let prevRevenue: number | null = null;
  let prevCount: number | null = null;
  if (cutoff != null && range.days != null) {
    const prevCutoff = cutoff - range.days * 86_400_000;
    const prevPeriod = everCompleted.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= prevCutoff && t < cutoff;
    });
    prevRevenue = prevPeriod.reduce((s, l) => s + (l.loadRate || 0), 0);
    prevCount = prevPeriod.length;
  }
  function pctChange(cur: number, prev: number | null): string | null {
    if (prev == null) return null;
    if (prev === 0) return cur > 0 ? "+100%" : null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs prior ${range.label.toLowerCase()}`;
  }

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
  const byDriver = new Map<string, { name: string; email: string; loads: number; revenue: number }>();
  for (const l of completed) {
    const key = (l.driverEmail || l.driverName || "unknown").toLowerCase();
    const cur = byDriver.get(key) || {
      name: l.driverName || l.driverEmail || "Unknown driver",
      email: l.driverEmail || "",
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
    {
      Icon: DollarSign, val: money(totalRevenue), label: "Total revenue", accent: "sx-emerald",
      delta: pctChange(totalRevenue, prevRevenue),
      info: `Sum of the load rate on every delivered/closed load in ${range.label.toLowerCase()}.`,
    },
    {
      Icon: Receipt, val: money(thisMonth), label: "This month", accent: "sx-blue", delta: null,
      info: "Sum of the load rate on loads completed in the current calendar month — not affected by the period filter above.",
    },
    {
      Icon: PackageCheck, val: String(completed.length), label: "Completed loads", accent: "sx-green",
      delta: pctChange(completed.length, prevCount),
      info: `Count of delivered/closed loads in ${range.label.toLowerCase()}.`,
    },
    {
      Icon: Package, val: money(avgPerLoad), label: "Avg / load", accent: "sx-sky", delta: null,
      info: "Total revenue divided by completed loads, for the selected period.",
    },
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

        <div className="ins-range">
          <div className="ins-range-tabs">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={r.key === "all" ? "/insights" : `/insights?range=${r.key}`}
                className={`ins-range-item${r.key === range.key ? " active" : ""}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <InsightsExport
            data={{
              rangeLabel: range.label,
              kpis: kpis.map((k) => ({ label: k.label, val: k.val })),
              weeks: weeks.map((w) => ({ label: w.label, total: w.total })),
              drivers,
            }}
          />
        </div>

        <div className="home-stats">
          {kpis.map((k) => {
            const Icon = k.Icon;
            return (
              <div className={`home-stat ${k.accent}`} key={k.label}>
                <div className="hs-ic"><Icon size={18} /></div>
                <div className="hs-val">{k.val}</div>
                <div className="hs-label">
                  {k.label}
                  <span className="hs-info" tabIndex={0} title={k.info} aria-label={k.info}>
                    <Info size={12} />
                  </span>
                </div>
                {k.delta && <div className="hs-delta">{k.delta}</div>}
              </div>
            );
          })}
        </div>

        {completed.length === 0 ? (
          <div className="home-empty">
            {everCompleted.length === 0 ? (
              <p>No delivered loads yet. Charts appear here as your drivers complete loads.</p>
            ) : (
              <>
                <p>No delivered loads in the last {range.label.toLowerCase()}.</p>
                <Link href="/insights" className="home-empty-link">Show all time</Link>
              </>
            )}
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
                  {drivers.map((d) => {
                    const inner = (
                      <>
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
                      </>
                    );
                    return d.email ? (
                      <Link
                        href={`/drivers/${encodeURIComponent(d.email)}`}
                        className="ins-drv-row ins-drv-link"
                        key={d.name}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="ins-drv-row" key={d.name}>
                        {inner}
                      </div>
                    );
                  })}
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
