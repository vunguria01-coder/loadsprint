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

function StatTile({ stat }: { stat: StatCard }) {
  const Icon = STAT_ICON[stat.icon];
  const value = useCountUp(stat.value);
  return (
    <div className={`dstat dstat-${stat.accent}`}>
      <div className="dstat-ic">
        <Icon size={18} />
      </div>
      <div className="dstat-val">
        {stat.prefix}
        {value.toLocaleString("en-US")}
      </div>
      <div className="dstat-label">{stat.label}</div>
      <div className={`dstat-sub sub-${stat.subTone || "muted"}`}>{stat.sub}</div>
    </div>
  );
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
        <span className={`dl-badge tone-${l.badgeTone}`}>{l.badgeLabel}</span>
      </div>
      <div className="dl-route">
        <span className="dl-city">{l.origin}</span>
        <ArrowRight size={15} className="dl-arrow" />
        <span className="dl-city">{l.dest}</span>
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
}: {
  stats: StatCard[];
  loads: DispatchLoad[];
  alerts: DispatchAlert[];
  filters: { key: string; label: string; count: number }[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const visible = useMemo(() => {
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
  }, [loads, query, filter]);

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

        {visible.length > 0 ? (
          <div className="dl-grid">
            {visible.map((l) => (
              <LoadCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <div className="board-empty">
            {loads.length === 0
              ? "No active loads right now."
              : "No loads match your search or filter."}
          </div>
        )}
      </section>
    </div>
  );
}
