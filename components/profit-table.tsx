"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export type ProfitRow = {
  id: string;
  ref: string;
  driver: string;
  route: string;
  rev: number;
  pay: number;
  margin: number;
  createdAt: string;
  search: string;
};

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Client-side search + sort over the period-filtered rows the server sent
// down, persisted in the URL like every other list in the app.
export function ProfitTable({ rows, rangeLabel }: { rows: ProfitRow[]; rangeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [sort, setSort] = useState<"" | "profit-desc" | "profit-asc" | "newest">(
    () => (searchParams.get("sort") as "profit-desc" | "profit-asc" | "newest") || ""
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q); else params.delete("q");
    if (sort) params.set("sort", sort); else params.delete("sort");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]);

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
  const filtered = query ? rows.filter((r) => r.search.includes(query)) : rows;
  const shown = (() => {
    if (sort === "profit-desc") return [...filtered].sort((a, b) => b.margin - a.margin);
    if (sort === "profit-asc") return [...filtered].sort((a, b) => a.margin - b.margin);
    if (sort === "newest") return [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return filtered;
  })();

  function exportCsv() {
    const header = ["Load", "Driver", "Route", "Revenue", "Driver pay", "Margin"];
    const csvRows = shown.map((r) => [r.ref, r.driver, r.route, String(r.rev), String(r.pay), String(r.margin)]);
    const csv = [header, ...csvRows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-by-load-${rangeLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
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
            placeholder="Search by load #, driver or route… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>✕</button>
          )}
        </div>
        <select
          className="lb-status"
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "profit-desc" | "profit-asc" | "newest")}
        >
          <option value="">Sort: newest first</option>
          <option value="profit-desc">Highest profit</option>
          <option value="profit-asc">Lowest profit</option>
          <option value="newest">Newest</option>
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={shown.length === 0}>
          Export CSV
        </button>
        {(q || sort) && (
          <button type="button" className="lb-clear-filters" onClick={() => { setQ(""); setSort(""); }}>
            Clear filters
          </button>
        )}
      </div>
      {(query || sort) && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {rows.length} load{rows.length === 1 ? "" : "s"}
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching loads"
          sub={query ? `No loads match "${q}".` : "No loads match this filter."}
          action={
            <button type="button" className="lb-clear-filters" onClick={() => { setQ(""); setSort(""); }}>
              Clear
            </button>
          }
        />
      ) : (
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
              {shown.map((r) => (
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
      )}
    </>
  );
}
