"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Package,
  Users,
  PackageCheck,
  AlertTriangle,
  Search,
  X,
  ArrowRight,
  ChevronRight,
  User,
  Truck,
  Box,
  Building2,
  CalendarClock,
  MapPin,
  Clock,
  Navigation,
  MessageSquare,
  FileCheck,
  Radio,
} from "lucide-react";
import type {
  DispatchLoad,
  DispatchAlert,
  StatCard,
} from "@/lib/dispatch-overview";
import { EmptyState } from "@/components/empty-state";

const STAT_ICON = {
  loads: Package,
  drivers: Users,
  deliveries: PackageCheck,
  attention: AlertTriangle,
} as const;

const ALERT_ICON = {
  red: AlertTriangle,
  orange: Clock,
  blue: MessageSquare,
  green: FileCheck,
  teal: Radio,
} as const;

// Animate a number from its previous value to the next whenever it changes.
function useCountUp(target: number, ms = 650): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, ms]);

  return display;
}

// Each KPI tile opens the page that explains the number, so it doubles as
// navigation instead of being a dead-end count.
const STAT_HREF: Partial<Record<StatCard["icon"], string>> = {
  loads: "/active-loads",
  drivers: "/drivers",
  deliveries: "/review",
};

function StatTile({ stat }: { stat: StatCard }) {
  const Icon = STAT_ICON[stat.icon];
  const value = useCountUp(stat.value);
  const href = STAT_HREF[stat.icon];
  const body = (
    <>
      <div className="dstat-ic">
        <Icon size={18} />
      </div>
      <div className="dstat-val">
        {stat.prefix}
        {value.toLocaleString("en-US")}
      </div>
      <div className="dstat-label">{stat.label}</div>
      <div className={`dstat-sub sub-${stat.subTone || "muted"}`}>{stat.sub}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`dstat dstat-${stat.accent} dstat-link`}>
        {body}
      </Link>
    );
  }
  return <div className={`dstat dstat-${stat.accent}`}>{body}</div>;
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="dl-meta-item" title={`${label}: ${value}`}>
      <Icon size={13} />
      <span className="dl-meta-label">{label}</span>
      <span className="dl-meta-value">{value}</span>
    </div>
  );
}

function LoadCard({ l }: { l: DispatchLoad }) {
  return (
    <Link href={`/loads/${l.id}`} className={`dl-card tone-${l.badgeTone}`}>
      <div className="dl-top">
        <span className="dl-ref">{l.ref}</span>
        <span className="dl-top-right">
          <span className={`dl-badge tone-${l.badgeTone}`}>{l.badgeLabel}</span>
          <ChevronRight size={16} className="dl-chevron" aria-hidden="true" />
        </span>
      </div>
      <div className="dl-route">
        <span className="dl-city" title={l.origin}>{l.origin}</span>
        <ArrowRight size={15} className="dl-arrow" />
        <span className="dl-city" title={l.dest}>{l.dest}</span>
      </div>
      <div className="dl-meta">
        <MetaItem icon={User} label="Driver" value={l.driverName} />
        <MetaItem icon={Truck} label="Truck" value={l.truckNumber} />
        <MetaItem icon={Box} label="Trailer" value={l.trailerNumber} />
        <MetaItem icon={Building2} label="Broker" value={l.brokerName} />
        <MetaItem icon={CalendarClock} label="Pickup" value={l.pickupAppt} />
        <MetaItem icon={MapPin} label="Delivery" value={l.deliveryAppt} />
        <MetaItem icon={Clock} label="ETA" value={l.etaText} />
        <MetaItem icon={Navigation} label="Remaining" value={l.distanceText} />
      </div>
    </Link>
  );
}

export function DispatchBoard({
  stats,
  loads,
  alerts,
  filters,
  limit,
  viewAllHref,
}: {
  stats: StatCard[];
  loads: DispatchLoad[];
  alerts: DispatchAlert[];
  filters: { key: string; label: string; count: number }[];
  // Home shows a short preview instead of the full searchable board — the
  // full list already lives at viewAllHref, so duplicating it here just
  // pushes today's alerts further down the page.
  limit?: number;
  viewAllHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const preview = typeof limit === "number";

  const visible = useMemo(() => {
    if (preview) return loads.slice(0, limit);
    const q = query.trim().toLowerCase();
    return loads.filter((l) => {
      if (filter !== "all" && l.filterKey !== filter) return false;
      if (!q) return true;
      return [
        l.ref,
        l.driverName,
        l.truckNumber,
        l.trailerNumber,
        l.brokerName,
        l.origin,
        l.dest,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [loads, query, filter, preview, limit]);

  return (
    <div className="dispatch-board">
      <div className="dstat-grid">
        {stats.map((s) => (
          <StatTile key={s.key} stat={s} />
        ))}
      </div>

      {alerts.length > 0 && (
        <section className="alerts">
          <div className="alerts-head">
            <h3>Today&rsquo;s Alerts</h3>
            <span className="alerts-count">{alerts.length}</span>
          </div>
          <div className="alerts-list">
            {alerts.map((a) => {
              const Icon = ALERT_ICON[a.tone];
              const body = (
                <>
                  <span className={`alert-dot tone-${a.tone}`}>
                    <Icon size={14} />
                  </span>
                  <span className="alert-text">
                    <span className="alert-title">{a.title}</span>
                    <span className="alert-detail">{a.detail}</span>
                  </span>
                </>
              );
              return a.loadId ? (
                <Link key={a.id} href={`/loads/${a.loadId}`} className={`alert tone-${a.tone}`}>
                  {body}
                </Link>
              ) : (
                <div key={a.id} className={`alert tone-${a.tone}`}>
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="board-main">
        {preview ? (
          <div className="board-toolbar board-toolbar-preview">
            <h3 className="board-preview-title">Active loads</h3>
            {viewAllHref && loads.length > limit! && (
              <Link href={viewAllHref} className="board-view-all">
                View all {loads.length}
              </Link>
            )}
          </div>
        ) : (
        <div className="board-toolbar">
          <div className="board-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search load, driver, truck, trailer, broker, city…"
              aria-label="Search loads"
            />
            {query && (
              <button
                type="button"
                className="board-search-clear"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="board-filters">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`fpill${filter === f.key ? " active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="fpill-count">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        {visible.length > 0 ? (
          <div className="dl-grid">
            {visible.map((l) => (
              <LoadCard key={l.id} l={l} />
            ))}
          </div>
        ) : loads.length === 0 ? (
          <EmptyState icon={<Package size={26} />} title="No active loads right now" sub="Create a load to get a truck moving." />
        ) : (
          <div className="board-empty">No loads match your search or filter.</div>
        )}
      </section>
    </div>
  );
}
