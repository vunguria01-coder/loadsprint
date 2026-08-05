"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, ArrowRight, Search, CalendarDays, Package, ChevronDown } from "lucide-react";
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
        <div className="lc-sub">
          {[
            load.docs > 0 && `${load.docs} doc${load.docs === 1 ? "" : "s"}`,
            load.photos > 0 && `${load.photos} photo${load.photos === 1 ? "" : "s"}`,
            load.messages > 0 && `${load.messages} message${load.messages === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
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
  const [sort, setSort] = useState<"" | "appt" | "ref">(
    () => (searchParams.get("sort") as "appt" | "ref") || ""
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(COLLAPSED_GROUPS_KEY); } catch {}
    if (!raw) return;
    try { setCollapsed(new Set(JSON.parse(raw))); } catch {}
  }, []);

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
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, sort]);

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
  const shown = useMemo(() => {
    const filtered = loads.filter(
      (l) => (!query || l.search.includes(query)) && (!status || l.status === status)
    );
    if (sort === "ref") return [...filtered].sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
    if (sort === "appt") {
      // No pickup date sorts last, not first — an unscheduled load isn't "soonest".
      return [...filtered].sort((a, b) => (a.pickupDate || "9999").localeCompare(b.pickupDate || "9999"));
    }
    return filtered;
  }, [loads, query, status, sort]);

  const groups = useMemo(() => {
    if (!grouped) return null;
    const m = new Map<string, LoadSummary[]>();
    for (const l of shown) {
      const key = l.driverName || "Unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    // Unassigned loads need a dispatcher's attention first — put that group
    // at the top instead of wherever it happened to fall alphabetically/by-insertion.
    return [...m.entries()].sort((a, b) =>
      a[0] === "Unassigned" ? -1 : b[0] === "Unassigned" ? 1 : 0
    );
  }, [shown, grouped]);

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

  return (
    <>
      {(query || status) && (
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
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "appt" | "ref")}
        >
          <option value="">Sort: default</option>
          <option value="appt">Appointment soonest</option>
          <option value="ref">Load number</option>
        </select>
        {(query || status || sort) && (
          <button
            type="button"
            className="lb-clear-filters"
            onClick={() => { setQ(""); setStatus(""); setSort(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

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
            <button type="button" className="lb-clear-filters" onClick={() => { setQ(""); setStatus(""); }}>
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
              <div className={`dg-av${isUnassigned ? " dg-av-warn" : ""}`}>
                {driver.split(" ").map((p) => p[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="dg-name">{driver}</div>
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
    </>
  );
}
