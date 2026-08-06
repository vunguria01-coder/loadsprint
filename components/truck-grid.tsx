"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Container, Search } from "lucide-react";
import { money } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  in_shop: "In shop",
  parked: "Parked",
  sold: "Sold",
};

export type TruckSummary = {
  id: string;
  name: string;
  unit?: string;
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  status: string;
  driverName: string | null;
  cost: number;
  income: number;
  net: number;
  search: string; // lowercased: unit, plate, vin, name, make, model
};

// Client-side search over unit #, plate # and VIN (there's no separate
// trailer record on a Truck — plate/unit are the identifiers dispatchers
// actually search by), persisted in the URL like Active loads/Drivers.
export function TruckGrid({ trucks }: { trucks: TruckSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [sort, setSort] = useState<"" | "unit-asc" | "unit-desc" | "plate-asc">(
    () => (searchParams.get("sort") as "unit-asc" | "unit-desc" | "plate-asc") || ""
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
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
  const filtered = query ? trucks.filter((t) => t.search.includes(query)) : trucks;
  // Trucks without a unit/plate sort last, not first — a blank value isn't "A".
  const shown = (() => {
    if (sort === "unit-asc") return [...filtered].sort((a, b) => (a.unit || "￿").localeCompare(b.unit || "￿", undefined, { numeric: true }));
    if (sort === "unit-desc") return [...filtered].sort((a, b) => (b.unit || "").localeCompare(a.unit || "", undefined, { numeric: true }));
    if (sort === "plate-asc") return [...filtered].sort((a, b) => (a.plate || "￿").localeCompare(b.plate || "￿", undefined, { numeric: true }));
    return filtered;
  })();

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
            placeholder="Search by unit #, plate # or VIN… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>✕</button>
          )}
        </div>
        <select
          className="lb-status"
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "unit-asc" | "unit-desc" | "plate-asc")}
        >
          <option value="">Sort: default</option>
          <option value="unit-asc">Unit # A-Z</option>
          <option value="unit-desc">Unit # Z-A</option>
          <option value="plate-asc">License plate A-Z</option>
        </select>
      </div>
      {query && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {trucks.length} truck{trucks.length === 1 ? "" : "s"}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="px">No trucks match "{q}".</p>
      ) : (
        <div className="truck-grid">
          {shown.map((t) => (
            <Link key={t.id} href={`/trucks/${t.id}`} className="truck-card">
              <div className="tc-top">
                <div className="tc-title">
                  <Container size={18} />
                  <span>{t.name}</span>
                </div>
                <span className={`tc-status st-${t.status}`}>
                  {STATUS_LABEL[t.status] || t.status}
                </span>
              </div>
              <div className="tc-sub">
                {[t.unit && `Unit ${t.unit}`, [t.year, t.make, t.model].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
              <div className="tc-driver">
                {t.driverName ? `Driver: ${t.driverName}` : "No driver assigned"}
              </div>
              <div className="tc-fin">
                <div>
                  <span className="tc-fin-l">Cost</span>
                  <span className="tc-fin-v">{money(t.cost)}</span>
                </div>
                <div>
                  <span className="tc-fin-l">Income</span>
                  <span className="tc-fin-v">{money(t.income)}</span>
                </div>
                <div>
                  <span className="tc-fin-l">Net</span>
                  <span className={`tc-fin-v ${t.net >= 0 ? "pos" : "neg"}`}>
                    {money(t.net)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
