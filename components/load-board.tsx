"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  ArrowRight,
  Search,
  CalendarDays,
  Package,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import type { LoadStatus } from "@/lib/loads";

// Format a "YYYY-MM-DD" date as a short local label (e.g. "Jul 8") without the
// UTC-parse timezone shift that new Date("YYYY-MM-DD") introduces.
function shortDate(ymd?: string): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const COLLAPSED_GROUPS_KEY = "ls_collapsed_load_groups";
const DENSITY_KEY = "ls_load_board_density";

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Client-side search + status filter over a dispatcher/admin/broker load list.
// Serialized summaries come from the server page; all filtering is instant.
export type LoadSummary = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: LoadStatus;
  driverName: string;
  docs: number;
  photos: number;
  messages: number;
  loadRate?: number;
  commodity?: string;
  weight?: number; // lbs
  pickupDate?: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  sharingLive: boolean;
  sharingPaused: boolean;
  search: string; // lowercased haystack
};

const STATUSES: LoadStatus[] = [
  "Assigned",
  "Picked Up",
  "In Transit",
  "At Delivery",
  "Delivered",
  "Closed",
];

function LoadCard({ load }: { load: LoadSummary }) {
  return (
    <Link href={`/loads/${load.id}`} className="load-card">
      <div className="lc-top">
        <span className="lc-ref">{load.ref}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {load.sharingLive && (
            <span className="loc-chip loc-live" title="Driver is sharing live GPS">📍 Live</span>
          )}
          {load.sharingPaused && (
            <span className="loc-chip loc-paused" title="Driver paused location sharing">📍 Paused</span>
          )}
          <StatusChip status={load.status} />
        </div>
      </div>
      <div className="lc-route">
        <MapPin /> {load.originName} <ArrowRight size={15} /> {load.destName}
      </div>
      {(load.commodity || (load.weight ?? 0) > 0) && (
        <div className="lc-cargo">
          <Package size={13} />
          {load.commodity && <span>{load.commodity}</span>}
          {load.commodity && (load.weight ?? 0) > 0 && <span className="lc-dsep">·</span>}
          {(load.weight ?? 0) > 0 && <span>{load.weight!.toLocaleString("en-US")} lbs</span>}
        </div>
      )}
      {(shortDate(load.pickupDate) || shortDate(load.deliveryDate)) && (
        <div className="lc-dates">
          <CalendarDays size={13} />
          {shortDate(load.pickupDate) && <span>Pickup {shortDate(load.pickupDate)}</span>}
          {shortDate(load.pickupDate) && shortDate(load.deliveryDate) && <span className="lc-dsep">→</span>}
          {shortDate(load.deliveryDate) && <span>Delivery {shortDate(load.deliveryDate)}</span>}
        </div>
      )}
      {/* Counters only earn their space when there is something to count —
          three zeros on every card is noise, not information. */}
      {(load.docs > 0 || load.photos > 0 || load.messages > 0) && (
        <div className="lc-chips">
          {load.docs > 0 && (
            <span className="lc-chip-mini" title={`${load.docs} document${load.docs === 1 ? "" : "s"}`}>
              <FileText size={12} /> {load.docs}
            </span>
          )}
          {load.photos > 0 && (
            <span className="lc-chip-mini" title={`${load.photos} photo${load.photos === 1 ? "" : "s"}`}>
              <ImageIcon size={12} /> {load.photos}
            </span>
          )}
          {load.messages > 0 && (
            <span className="lc-chip-mini" title={`${load.messages} message${load.messages === 1 ? "" : "s"}`}>
              <MessageSquare size={12} /> {load.messages}
            </span>
          )}
        </div>
      )}
      {typeof load.loadRate === "number" && load.loadRate > 0 && (
        <div className="lc-price">${load.loadRate.toLocaleString("en-US")}</div>
      )}
    </Link>
  );
}

export function LoadBoard({
  loads,
  grouped = true,
}: {
  loads: LoadSummary[];
  grouped?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [status, setStatus] = useState<"" | LoadStatus>(
    () => (searchParams.get("status") as LoadStatus) || ""
  );
  const [sort, setSort] = useState<"" | "appt" | "ref" | "price-desc" | "price-asc">(
    () => (searchParams.get("sort") as "appt" | "ref" | "price-desc" | "price-asc") || ""
  );
  const [groupBy, setGroupBy] = useState<"driver" | "status">(
    () => (searchParams.get("groupBy") as "status") || "driver"
  );
  const [driverFilter, setDriverFilter] = useState(() => searchParams.get("driver") || "");
  const [when, setWhen] = useState<"" | "today" | "7d" | "none">(
    () => (searchParams.get("when") as "today" | "7d" | "none") || ""
  );
  const [has, setHas] = useState<"" | "messages" | "documents" | "photos">(
    () => (searchParams.get("has") as "messages" | "documents" | "photos") || ""
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(COLLAPSED_GROUPS_KEY); } catch {}
    if (!raw) return;
    try { setCollapsed(new Set(JSON.parse(raw))); } catch {}
  }, []);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(DENSITY_KEY); } catch {}
    if (raw === "compact") setDensity("compact");
  }, []);

  function setDensityAndPersist(d: "comfortable" | "compact") {
    setDensity(d);
    try { localStorage.setItem(DENSITY_KEY, d); } catch {}
  }

  function toggleGroup(driver: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(driver)) next.delete(driver);
      else next.add(driver);
      try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Keep the URL in sync so a reload or a back-navigation from a load's
  // detail page returns to the same filtered view instead of resetting it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort) params.set("sort", sort);
    if (groupBy !== "driver") params.set("groupBy", groupBy);
    if (driverFilter) params.set("driver", driverFilter);
    if (when) params.set("when", when);
    if (has) params.set("has", has);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, sort, groupBy, driverFilter, when, has]);

  // "/" jumps to the search box (unless it would steal a keystroke from
  // another field, e.g. the reference-number input while typing text).
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = q.trim().toLowerCase();
  // Counts reflect the current search but not the status filter itself, so
  // picking a different status in the dropdown never zeroes its own count.
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<LoadStatus, number>> = {};
    for (const l of loads) {
      if (query && !l.search.includes(query)) continue;
      counts[l.status] = (counts[l.status] || 0) + 1;
    }
    return counts;
  }, [loads, query]);
  // Same reasoning: reflects search, not the driver filter itself.
  const driverCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of loads) {
      if (query && !l.search.includes(query)) continue;
      const name = l.driverName || "Unassigned";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [loads, query]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const next7Str = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const shown = useMemo(() => {
    const filtered = loads.filter((l) => {
      if (query && !l.search.includes(query)) return false;
      if (status && l.status !== status) return false;
      if (driverFilter && (l.driverName || "Unassigned") !== driverFilter) return false;
      if (when === "today" && l.pickupDate !== todayStr) return false;
      if (when === "7d" && !(l.pickupDate && l.pickupDate >= todayStr && l.pickupDate <= next7Str)) return false;
      if (when === "none" && l.pickupDate) return false;
      if (has === "messages" && l.messages <= 0) return false;
      if (has === "documents" && l.docs <= 0) return false;
      if (has === "photos" && l.photos <= 0) return false;
      return true;
    });
    if (sort === "ref") return [...filtered].sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
    if (sort === "appt") {
      // No pickup date sorts last, not first — an unscheduled load isn't "soonest".
      return [...filtered].sort((a, b) => (a.pickupDate || "9999").localeCompare(b.pickupDate || "9999"));
    }
    if (sort === "price-desc" || sort === "price-asc") {
      // A load with no rate yet isn't "cheapest" — it goes to the end either way.
      return [...filtered].sort((a, b) => {
        const av = a.loadRate ?? -1;
        const bv = b.loadRate ?? -1;
        if (av < 0 && bv < 0) return 0;
        if (av < 0) return 1;
        if (bv < 0) return -1;
        return sort === "price-desc" ? bv - av : av - bv;
      });
    }
    return filtered;
  }, [loads, query, status, sort, driverFilter, when, has, todayStr, next7Str]);

  const priceSummary = useMemo(() => {
    let total = 0;
    let noPrice = 0;
    for (const l of shown) {
      if (typeof l.loadRate === "number" && l.loadRate > 0) total += l.loadRate;
      else noPrice++;
    }
    return { total, noPrice };
  }, [shown]);

  const groups = useMemo(() => {
    if (!grouped) return null;
    const m = new Map<string, LoadSummary[]>();
    for (const l of shown) {
      const key = groupBy === "status" ? l.status : l.driverName || "Unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    if (groupBy === "status") {
      // Follow the pipeline order, not alphabetical.
      return [...m.entries()].sort(
        (a, b) => STATUSES.indexOf(a[0] as LoadStatus) - STATUSES.indexOf(b[0] as LoadStatus)
      );
    }
    // Unassigned loads need a dispatcher's attention first — put that group
    // at the top instead of wherever it happened to fall alphabetically/by-insertion.
    return [...m.entries()].sort((a, b) =>
      a[0] === "Unassigned" ? -1 : b[0] === "Unassigned" ? 1 : 0
    );
  }, [shown, grouped, groupBy]);

  function collapseAll() {
    if (!groups) return;
    const all = new Set(groups.map(([driver]) => driver));
    setCollapsed(all);
    try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...all])); } catch {}
  }
  function expandAll() {
    setCollapsed(new Set());
    try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([])); } catch {}
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setSort("");
    setDriverFilter("");
    setWhen("");
    setHas("");
  }

  function exportCsv() {
    const header = ["Load", "Status", "Driver", "Origin", "Destination", "Rate"];
    const rows = shown.map((l) => [
      l.ref,
      l.status,
      l.driverName,
      l.originName,
      l.destName,
      typeof l.loadRate === "number" ? String(l.loadRate) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`lb-root${density === "compact" ? " lb-compact" : ""}`}>
      {(query || status || driverFilter || when || has) && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {loads.length} load{loads.length === 1 ? "" : "s"}
        </p>
      )}
      <div className="lb-controls">
        <div className="driver-search lb-search">
          <Search size={18} />
          <input
            ref={searchRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              if (q) setQ("");
              else (e.target as HTMLInputElement).blur();
            }}
            placeholder="Search by load #, driver, route or broker… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>✕</button>
          )}
        </div>
        <select
          className="lb-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | LoadStatus)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s} ({statusCounts[s] || 0})</option>
          ))}
        </select>
        <select
          className="lb-status"
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
        >
          <option value="">All drivers</option>
          {driverCounts.map(([name, count]) => (
            <option key={name} value={name}>{name} ({count})</option>
          ))}
        </select>
        <select
          className="lb-status"
          value={when}
          onChange={(e) => setWhen(e.target.value as "" | "today" | "7d" | "none")}
        >
          <option value="">Any appointment</option>
          <option value="today">Pickup today</option>
          <option value="7d">Pickup next 7 days</option>
          <option value="none">No appointment</option>
        </select>
        <select
          className="lb-status"
          value={has}
          onChange={(e) => setHas(e.target.value as "" | "messages" | "documents" | "photos")}
        >
          <option value="">Anything</option>
          <option value="messages">Has messages</option>
          <option value="documents">Has documents</option>
          <option value="photos">Has photos</option>
        </select>
        <select
          className="lb-status"
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "appt" | "ref" | "price-desc" | "price-asc")}
          title="Order the loads were created — oldest first"
        >
          <option value="">Date added</option>
          <option value="appt">Appointment soonest</option>
          <option value="ref">Load number</option>
          <option value="price-desc">Highest price</option>
          <option value="price-asc">Lowest price</option>
        </select>
        {grouped && (
          <select
            className="lb-status"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "driver" | "status")}
          >
            <option value="driver">Group: by driver</option>
            <option value="status">Group: by status</option>
          </select>
        )}
        <select
          className="lb-status"
          value={density}
          onChange={(e) => setDensityAndPersist(e.target.value as "comfortable" | "compact")}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={shown.length === 0}>
          Export CSV
        </button>
        {(query || status || sort || driverFilter || when || has) && (
          <button type="button" className="lb-clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {(query || status || sort || driverFilter || when || has) && (
        <div className="lb-filter-chips">
          {query && (
            <span className="lb-filter-chip">
              Search: "{q}"
              <button type="button" onClick={() => setQ("")} aria-label="Clear search">✕</button>
            </span>
          )}
          {status && (
            <span className="lb-filter-chip">
              Status: {status}
              <button type="button" onClick={() => setStatus("")} aria-label="Clear status filter">✕</button>
            </span>
          )}
          {driverFilter && (
            <span className="lb-filter-chip">
              Driver: {driverFilter}
              <button type="button" onClick={() => setDriverFilter("")} aria-label="Clear driver filter">✕</button>
            </span>
          )}
          {when && (
            <span className="lb-filter-chip">
              {when === "today" ? "Pickup today" : when === "7d" ? "Pickup next 7 days" : "No appointment"}
              <button type="button" onClick={() => setWhen("")} aria-label="Clear appointment filter">✕</button>
            </span>
          )}
          {has && (
            <span className="lb-filter-chip">
              Has {has}
              <button type="button" onClick={() => setHas("")} aria-label="Clear has filter">✕</button>
            </span>
          )}
          {sort && (
            <span className="lb-filter-chip">
              Sort: {sort === "appt" ? "Appointment soonest" : sort === "ref" ? "Load number" : sort === "price-desc" ? "Highest price" : "Lowest price"}
              <button type="button" onClick={() => setSort("")} aria-label="Clear sort">✕</button>
            </span>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <p className="lb-price-summary">
          {money(priceSummary.total)} total
          {priceSummary.noPrice > 0 && ` · ${priceSummary.noPrice} load${priceSummary.noPrice === 1 ? "" : "s"} without a price`}
        </p>
      )}

      {grouped && groups && groups.length > 1 && (
        <div className="lb-group-controls">
          <button type="button" className="lb-clear-filters" onClick={collapseAll}>
            Collapse all
          </button>
          <button type="button" className="lb-clear-filters" onClick={expandAll}>
            Expand all
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching loads"
          sub="Try a different search term or status."
          action={
            <button type="button" className="lb-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : grouped && groups ? (
        groups.map(([driver, dloads]) => {
          const groupTotal = dloads.reduce((s, l) => s + (l.loadRate || 0), 0);
          const isCollapsed = collapsed.has(driver);
          const isUnassigned = driver === "Unassigned";
          return (
          <div className={`driver-group${isUnassigned ? " driver-group-warn" : ""}`} key={driver}>
            <button
              type="button"
              className="dg-head dg-head-btn"
              onClick={() => toggleGroup(driver)}
              aria-expanded={!isCollapsed}
            >
              {groupBy === "status" ? (
                <StatusChip status={driver as LoadStatus} />
              ) : (
                <div className={`dg-av${isUnassigned ? " dg-av-warn" : ""}`}>
                  {driver.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
              )}
              <div>
                {groupBy !== "status" && <div className="dg-name">{driver}</div>}
                <div className="dg-meta">
                  {dloads.length} load{dloads.length === 1 ? "" : "s"}
                  {groupTotal > 0 && <> · <span className="dg-total">{money(groupTotal)}</span></>}
                </div>
              </div>
              <ChevronDown className={`dg-chev${isCollapsed ? " collapsed" : ""}`} size={18} />
            </button>
            {!isCollapsed && (
              <div className="load-cards">
                {dloads.map((l) => (
                  <LoadCard key={l.id} load={l} />
                ))}
              </div>
            )}
          </div>
          );
        })
      ) : (
        <div className="load-cards">
          {shown.map((l) => (
            <LoadCard key={l.id} load={l} />
          ))}
        </div>
      )}
    </div>
  );
}
