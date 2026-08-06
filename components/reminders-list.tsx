"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Container, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export type ReminderRow = {
  truckId: string;
  truckName: string;
  type: "doc" | "maintenance";
  label: string;
  status: "overdue" | "soon" | "ok";
  detail: string;
  group: "overdue" | "today" | "soon";
  search: string; // lowercased: unit, plate, truck name, item label
};

function Row({ r }: { r: ReminderRow }) {
  const cls = r.status === "overdue" ? "bad" : "warn";
  return (
    <Link href={`/trucks/${r.truckId}`} className="rem-row">
      <span className={`rem-stripe ${cls}`} />
      <div className="rem-mid">
        <div className="rem-title">
          {r.label} <span className="rem-type">{r.type === "doc" ? "document" : "maintenance"}</span>
        </div>
        <div className="rem-truck"><Container size={13} /> {r.truckName}</div>
      </div>
      <span className={`ar-days ${cls}`}>{r.detail}</span>
    </Link>
  );
}

// Client-side search over unit #, plate # and the document/maintenance name,
// persisted in the URL like Active loads/Drivers/Trucks.
export function RemindersList({ rows }: { rows: ReminderRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [type, setType] = useState<"" | "doc" | "maintenance">(
    () => (searchParams.get("type") as "doc" | "maintenance") || ""
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type]);

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
  const shown = rows
    .filter((r) => !query || r.search.includes(query))
    .filter((r) => !type || r.type === type);

  const overdue = shown.filter((r) => r.group === "overdue");
  const today = shown.filter((r) => r.group === "today");
  const soon = shown.filter((r) => r.group === "soon");

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
            placeholder="Search by unit #, plate # or item… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>✕</button>
          )}
        </div>
        <select
          className="lb-status"
          value={type}
          onChange={(e) => setType(e.target.value as "" | "doc" | "maintenance")}
        >
          <option value="">All</option>
          <option value="doc">Documents</option>
          <option value="maintenance">Maintenance</option>
        </select>
        {(q || type) && (
          <button
            type="button"
            className="lb-clear-filters"
            onClick={() => { setQ(""); setType(""); }}
          >
            Clear filters
          </button>
        )}
      </div>
      {(query || type) && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {rows.length} reminder{rows.length === 1 ? "" : "s"}
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching reminders"
          sub={query ? `No reminders match "${q}".` : "No reminders match this filter."}
          action={
            <button
              type="button"
              className="lb-clear-filters"
              onClick={() => { setQ(""); setType(""); }}
            >
              Clear
            </button>
          }
        />
      ) : (
        <>
          {overdue.length > 0 && (
            <div className="ins-section">
              <h3>Overdue</h3>
              <p className="ins-sub">Handle these now.</p>
              <div className="rem-list">{overdue.map((r, i) => <Row key={i} r={r} />)}</div>
            </div>
          )}
          {today.length > 0 && (
            <div className="ins-section">
              <h3>Today</h3>
              <p className="ins-sub">Expiring today.</p>
              <div className="rem-list">{today.map((r, i) => <Row key={i} r={r} />)}</div>
            </div>
          )}
          {soon.length > 0 && (
            <div className="ins-section">
              <h3>Upcoming</h3>
              <p className="ins-sub">Within 30 days or 1,500 miles.</p>
              <div className="rem-list">{soon.map((r, i) => <Row key={i} r={r} />)}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
