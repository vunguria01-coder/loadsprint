"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, MoreVertical, Search, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

type DriverRow = {
  email: string;
  name: string;
  joined: boolean;
  total: number;
  active: number;
  search: string; // lowercased haystack: name, email, load refs, broker names
};

type EldBatchState = "not_linked" | "not_connected" | "not_verified" | "no_data" | "available" | "temporarily_unavailable";

type EldBatchEntry =
  | { email: string; state: Exclude<EldBatchState, "available"> }
  | {
      email: string;
      state: "available";
      dutyStatus: string;
      driveRemainingMin: number | null;
      shiftRemainingMin: number | null;
      cycleRemainingMin: number | null;
      vehicleName: string | null;
      vehicleVin: string | null;
      sourceUpdatedAt: string | null;
      fetchedAt: string;
    };

const ELD_DUTY_LABELS: Record<string, string> = {
  off_duty: "Off duty",
  sleeper: "Sleeper berth",
  driving: "Driving",
  on_duty: "On duty",
  yard_move: "Yard move",
  personal_conveyance: "Personal conveyance",
  unknown: "Unknown",
};

// One calm, honest line per non-available state — never a button, never a
// guess. not_connected and not_verified collapse into the same copy: both
// mean "this company's ELD connection can't be used for HOS right now,"
// which is all a dispatcher scanning the fleet list needs to know.
const ELD_EMPTY_COPY: Record<Exclude<EldBatchState, "available">, string> = {
  not_linked: "Not linked",
  not_connected: "ELD not connected",
  not_verified: "ELD not connected",
  no_data: "Waiting for data",
  temporarily_unavailable: "Unavailable",
};

function fmtEldMin(v: number | null): string {
  if (v == null) return "Not available";
  const h = Math.floor(v / 60);
  const m = v % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Exact elapsed time, not a vague "Live" badge — same reasoning as the
// individual driver page's ELD card: the real sync cadence isn't agreed
// with any provider yet, so this only ever states what's actually known.
function fmtEldUpdatedAgo(iso: string | null): string {
  if (!iso) return "Not available";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Not available";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

function locationAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function DriversList({
  drivers,
  located = [],
  locationAt = {},
}: {
  drivers: DriverRow[];
  located?: string[];
  locationAt?: Record<string, string>;
}) {
  const locatedSet = useMemo(() => new Set(located), [located]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [sort, setSort] = useState<"" | "name-asc" | "name-desc" | "active">(
    () => (searchParams.get("sort") as "name-asc" | "name-desc" | "active") || ""
  );
  const [filter, setFilter] = useState<"" | "with" | "without" | "attention">(
    () => (searchParams.get("filter") as "with" | "without" | "attention") || ""
  );
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [eldMap, setEldMap] = useState<Record<string, EldBatchEntry>>({});

  // One batch request for the whole roster — never one request per driver
  // row. The route only reads stored snapshots (no adapter/network calls),
  // so this is cheap even for a large fleet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/eld-status-batch", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) {
          setEldMap(Object.fromEntries((json.drivers as EldBatchEntry[]).map((d) => [d.email, d])));
        }
      } catch {
        /* ignore — rows just show no ELD info */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Same reason as Active loads: a reload or a back-navigation from a
  // driver's detail page should return to the same search, not reset it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (filter) params.set("filter", filter);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, filter]);

  // Same "/" shortcut as Active loads — ignored while any input already
  // has focus, so it never steals a keystroke mid-typing.
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

  // What actually needs a dispatcher's attention right now: an ELD that was
  // linked and stopped reporting, HOS hours run low, or GPS gone stale.
  // "Not linked" isn't a problem — most fleets don't have ELD on every truck.
  const attentionReasons = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const d of drivers) {
      const reasons: string[] = [];
      const eld = eldMap[d.email];
      if (eld && (eld.state === "not_connected" || eld.state === "not_verified" || eld.state === "temporarily_unavailable")) {
        reasons.push("ELD offline");
      }
      if (eld?.state === "available" && eld.driveRemainingMin != null && eld.driveRemainingMin < 60) {
        reasons.push("HOS low");
      }
      const at = locationAt[d.email];
      if (at && Date.now() - new Date(at).getTime() > 24 * 60 * 60 * 1000) {
        reasons.push("Location stale");
      }
      if (reasons.length) map[d.email] = reasons;
    }
    return map;
  }, [drivers, eldMap, locationAt]);

  const query = q.trim().toLowerCase();
  // Counts respect the current search but not the filter itself, same
  // reasoning as the status counts on Active loads.
  const searched = query ? drivers.filter((d) => d.search.includes(query)) : drivers;
  const withCount = searched.filter((d) => d.active > 0).length;
  const withoutCount = searched.length - withCount;
  const attentionCount = searched.filter((d) => attentionReasons[d.email]).length;
  const shown = (() => {
    let filtered = searched;
    if (filter === "with") filtered = filtered.filter((d) => d.active > 0);
    else if (filter === "without") filtered = filtered.filter((d) => d.active === 0);
    else if (filter === "attention") filtered = filtered.filter((d) => attentionReasons[d.email]);
    if (sort === "name-asc") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name-desc") return [...filtered].sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "active") return [...filtered].sort((a, b) => b.active - a.active);
    // Default: drivers that need attention float to the top, otherwise the
    // roster keeps its original order — this is the "problems first" view.
    return filtered
      .map((d, i) => ({ d, i }))
      .sort((a, b) => {
        const pa = attentionReasons[a.d.email] ? 1 : 0;
        const pb = attentionReasons[b.d.email] ? 1 : 0;
        return pb - pa || a.i - b.i;
      })
      .map((x) => x.d);
  })();

  async function remove(email: string) {
    setBusy(email);
    try {
      const res = await fetch("/api/driver-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not remove", data.error || "Try again.");
      } else {
        toast("Driver removed", `${email} was removed from your roster.`);
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <>
      {query && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {drivers.length} driver{drivers.length === 1 ? "" : "s"}
        </p>
      )}
      <div className="driver-controls">
        <div className="driver-search">
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
            placeholder="Search by driver, email, load # or broker… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>
              ✕
            </button>
          )}
        </div>
        <select
          className="lb-status"
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "name-asc" | "name-desc" | "active")}
        >
          <option value="">Sort: default</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="active">Most active loads</option>
        </select>
        <select
          className="lb-status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "" | "with" | "without" | "attention")}
        >
          <option value="">All ({searched.length})</option>
          <option value="attention">Needs attention ({attentionCount})</option>
          <option value="with">With active loads ({withCount})</option>
          <option value="without">Without active loads ({withoutCount})</option>
        </select>
        {(query || sort || filter) && (
          <button
            type="button"
            className="lb-clear-filters"
            onClick={() => { setQ(""); setSort(""); setFilter(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {(query || sort || filter) && (
        <div className="lb-filter-chips">
          {query && (
            <span className="lb-filter-chip">
              Search: "{q}"
              <button type="button" onClick={() => setQ("")} aria-label="Clear search">✕</button>
            </span>
          )}
          {sort && (
            <span className="lb-filter-chip">
              Sort: {sort === "name-asc" ? "Name A-Z" : sort === "name-desc" ? "Name Z-A" : "Most active loads"}
              <button type="button" onClick={() => setSort("")} aria-label="Clear sort">✕</button>
            </span>
          )}
          {filter && (
            <span className="lb-filter-chip">
              {filter === "with" ? "With active loads" : filter === "without" ? "Without active loads" : "Needs attention"}
              <button type="button" onClick={() => setFilter("")} aria-label="Clear filter">✕</button>
            </span>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching drivers"
          sub={query ? `No drivers match "${q}".` : "No drivers match this filter."}
          action={
            <button
              type="button"
              className="lb-clear-filters"
              onClick={() => { setQ(""); setSort(""); setFilter(""); }}
            >
              {query ? "Clear search" : "Clear filters"}
            </button>
          }
        />
      ) : (
        <div className="load-list">
          {shown.map((d) => (
            <div key={d.email} id={`driver-row-${d.email}`} className="load-card driver-row-wrap">
              <Link
                href={`/drivers/${encodeURIComponent(d.email)}`}
                className="driver-row-link"
                style={{ textDecoration: "none" }}
              >
                <div className="drv-av" aria-hidden="true">
                  {(d.name || d.email).trim().charAt(0).toUpperCase()}
                </div>
                <div className="lc-main drv-main">
                  <div className="drv-top">
                    <span className="driver-name-lg">{d.name}</span>
                    <span className={`drv-badge ${d.joined ? "ok" : "pending"}`}>
                      {d.joined ? "Active" : "Pending"}
                    </span>
                    {attentionReasons[d.email] && (
                      <span className="drv-badge attention" title={attentionReasons[d.email].join(", ")}>
                        ⚠ {attentionReasons[d.email].join(" · ")}
                      </span>
                    )}
                  </div>
                  <div className="drv-email">{d.email}</div>
                  <div className="drv-chips">
                    <span className="drv-chip"><b>{d.active}</b> active load{d.active === 1 ? "" : "s"}</span>
                    <span className="drv-chip"><b>{d.total}</b> total load{d.total === 1 ? "" : "s"}</span>
                    {locationAt[d.email] ? (() => {
                      const stale = Date.now() - new Date(locationAt[d.email]).getTime() > 24 * 60 * 60 * 1000;
                      return (
                        <span className={`drv-chip${stale ? " drv-chip-stale" : ""}`}>
                          Updated {locationAgo(locationAt[d.email])}
                        </span>
                      );
                    })() : (
                      <span className="drv-chip">No location yet</span>
                    )}
                  </div>
                  {(() => {
                    const eld = eldMap[d.email];
                    if (!eld) return null;
                    if (eld.state !== "available") {
                      return (
                        <div className="drv-chips" style={{ marginTop: 6 }}>
                          <span className="drv-chip">{ELD_EMPTY_COPY[eld.state]}</span>
                        </div>
                      );
                    }
                    return (
                      <div className="drv-chips" style={{ marginTop: 6, alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>
                          {ELD_DUTY_LABELS[eld.dutyStatus] || eld.dutyStatus}
                        </span>
                        <span style={{ fontWeight: 800, color: "#fff", fontSize: 13 }}>
                          {fmtEldMin(eld.driveRemainingMin)} drive
                        </span>
                        <span className="drv-chip">
                          Shift {fmtEldMin(eld.shiftRemainingMin)} · Cycle {fmtEldMin(eld.cycleRemainingMin)}
                        </span>
                        <span className="drv-chip">{eld.vehicleName || "Not available"}</span>
                        <span className="drv-chip">{fmtEldUpdatedAgo(eld.sourceUpdatedAt || eld.fetchedAt)}</span>
                      </div>
                    );
                  })()}
                </div>
                <ChevronRight className="drv-chev" />
              </Link>

              {confirm === d.email ? (
                <div className="driver-row-confirm">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => remove(d.email)}
                    disabled={busy === d.email}
                  >
                    {busy === d.email ? "…" : "Confirm"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  {locatedSet.has(d.email) && (
                    <button
                      type="button"
                      className="row-locate-btn"
                      title="Locate on map"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("locate-driver", { detail: { email: d.email } })
                        )
                      }
                    >
                      <MapPin size={14} /> Locate on map
                    </button>
                  )}
                <div className="row-menu-wrap">
                  <button
                    className="row-menu-btn"
                    onClick={() => setMenuOpen(menuOpen === d.email ? null : d.email)}
                    title="More options"
                    aria-label="More options"
                    aria-haspopup="true"
                    aria-expanded={menuOpen === d.email}
                  >
                    <MoreVertical size={17} />
                  </button>
                  {menuOpen === d.email && (
                    <>
                      <div className="cab-acc-scrim" onClick={() => setMenuOpen(null)} />
                      <div className="row-menu">
                        <button
                          className="row-menu-item danger"
                          onClick={() => {
                            setMenuOpen(null);
                            setConfirm(d.email);
                          }}
                        >
                          <Trash2 size={15} /> Remove driver
                        </button>
                      </div>
                    </>
                  )}
                </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
