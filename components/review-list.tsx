"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Image as ImageIcon, FileText, PackageCheck } from "lucide-react";
import type { Load } from "@/lib/loads";
import { BrokerPackage } from "@/components/broker-package";
import { EmptyState } from "@/components/empty-state";

export function ReviewList({ loads }: { loads: Load[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [range, setRange] = useState<"" | "today" | "7d" | "30d">(
    () => (searchParams.get("range") as "today" | "7d" | "30d") || ""
  );
  const [sort, setSort] = useState<"" | "newest" | "oldest" | "ref">(
    () => (searchParams.get("sort") as "newest" | "oldest" | "ref") || ""
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (range) params.set("range", range);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, range, sort]);

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
  const DAY = 86400000;
  const searched = query
    ? loads.filter((l) =>
        [l.ref, l.originName, l.destName, l.driverName, l.driverEmail]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(query))
      )
    : loads;
  // Range counts respect the current search but not the range itself, same
  // reasoning as the status counts on Active loads.
  const ageMs = (l: Load) => {
    const at = l.deliveredAt || l.createdAt;
    return at ? Date.now() - new Date(at).getTime() : Infinity;
  };
  const todayCount = searched.filter((l) => ageMs(l) <= DAY).length;
  const sevenDayCount = searched.filter((l) => ageMs(l) <= 7 * DAY).length;
  const thirtyDayCount = searched.filter((l) => ageMs(l) <= 30 * DAY).length;

  const rangeMs = range === "today" ? DAY : range === "7d" ? 7 * DAY : range === "30d" ? 30 * DAY : 0;
  const shown = rangeMs ? searched.filter((l) => ageMs(l) <= rangeMs) : searched;

  const groups = new Map<string, { name: string; loads: Load[] }>();
  for (const l of shown) {
    const key = (l.driverEmail || "unknown").toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: l.driverName || l.driverEmail || "Unknown driver", loads: [] });
    groups.get(key)!.loads.push(l);
  }
  const driverGroups = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  // Sort within each driver's group — grouping by driver stays, only the
  // order of loads inside each group changes.
  if (sort) {
    for (const g of driverGroups) {
      if (sort === "ref") g.loads.sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
      else {
        const dir = sort === "newest" ? -1 : 1;
        g.loads.sort((a, b) => dir * ((a.deliveredAt || a.createdAt) || "").localeCompare((b.deliveredAt || b.createdAt) || ""));
      }
    }
  }

  function exportCsv() {
    const header = ["Ref", "Status", "Driver", "Driver email", "Origin", "Destination", "Rate", "Delivered"];
    const rows = driverGroups.flatMap((g) =>
      g.loads.map((l) => [
        l.ref,
        l.status,
        l.driverName || "",
        l.driverEmail || "",
        l.originName,
        l.destName,
        typeof l.loadRate === "number" ? String(l.loadRate) : "",
        l.deliveredAt || l.createdAt || "",
      ])
    );
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "completed-loads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {(query || range) && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {loads.length} completed load{loads.length === 1 ? "" : "s"}
        </p>
      )}
      <div className="driver-controls" style={{ marginBottom: 20 }}>
        <div className="driver-search" style={{ marginBottom: 0 }}>
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
            placeholder="Search by load #, route or driver… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>
              ✕
            </button>
          )}
        </div>
        <select
          className="lb-status"
          value={range}
          onChange={(e) => setRange(e.target.value as "" | "today" | "7d" | "30d")}
        >
          <option value="">All time ({searched.length})</option>
          <option value="today">Today ({todayCount})</option>
          <option value="7d">Last 7 days ({sevenDayCount})</option>
          <option value="30d">Last 30 days ({thirtyDayCount})</option>
        </select>
        <select
          className="lb-status"
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "newest" | "oldest" | "ref")}
        >
          <option value="">Sort: default</option>
          <option value="newest">Newest delivered</option>
          <option value="oldest">Oldest delivered</option>
          <option value="ref">Load number</option>
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={shown.length === 0}>
          Export CSV
        </button>
        {(query || range || sort) && (
          <button
            type="button"
            className="lb-clear-filters"
            onClick={() => { setQ(""); setRange(""); setSort(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {driverGroups.length === 0 ? (
        <EmptyState
          icon={query || range ? <Search size={26} /> : <PackageCheck size={26} />}
          title={query || range ? "No matching loads" : "No completed loads yet"}
          sub={
            query
              ? `No completed loads match "${q}".`
              : range
                ? "No completed loads in this date range."
                : "Delivered and closed loads will appear here for review."
          }
          action={
            query || range ? (
              <button type="button" className="lb-clear-filters" onClick={() => { setQ(""); setRange(""); }}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        driverGroups.map((g) => (
          <div key={g.name} className="rev-group">
            <div className="rev-driver">
              {g.name}
              <span className="rev-count">{g.loads.length} load{g.loads.length === 1 ? "" : "s"}</span>
            </div>
            <div className="load-list">
              {g.loads.map((l) => (
                <div key={l.id} className="rev-card">
                  <Link href={`/loads/${l.id}`} className="rev-main" style={{ textDecoration: "none" }}>
                    <div className="lc-top">
                      <span className="lc-ref">{l.ref}</span>
                      <span className="status-chip">{l.status}</span>
                      {typeof l.loadRate === "number" && (
                        <span className="rev-price">${l.loadRate.toLocaleString("en-US")}</span>
                      )}
                    </div>
                    <div className="lc-route">{l.originName} → {l.destName}</div>
                    <div className="rev-meta">
                      <span><ImageIcon size={14} /> {l.photos?.length || 0} photos</span>
                      <span><FileText size={14} /> {l.documents?.length || 0} docs</span>
                    </div>
                  </Link>
                  <BrokerPackage loadId={l.id} loadRef={l.ref} compact />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
