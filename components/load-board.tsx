"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Search, CalendarDays } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
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
      {(shortDate(load.pickupDate) || shortDate(load.deliveryDate)) && (
        <div className="lc-dates">
          <CalendarDays size={13} />
          {shortDate(load.pickupDate) && <span>Pickup {shortDate(load.pickupDate)}</span>}
          {shortDate(load.pickupDate) && shortDate(load.deliveryDate) && <span className="lc-dsep">→</span>}
          {shortDate(load.deliveryDate) && <span>Delivery {shortDate(load.deliveryDate)}</span>}
        </div>
      )}
      <div className="lc-sub">
        {load.docs} docs · {load.photos} photos · {load.messages} messages
      </div>
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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | LoadStatus>("");

  const query = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      loads.filter(
        (l) => (!query || l.search.includes(query)) && (!status || l.status === status)
      ),
    [loads, query, status]
  );

  const groups = useMemo(() => {
    if (!grouped) return null;
    const m = new Map<string, LoadSummary[]>();
    for (const l of shown) {
      const key = l.driverName || "Unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return [...m.entries()];
  }, [shown, grouped]);

  return (
    <>
      <div className="lb-controls">
        <div className="driver-search lb-search">
          <Search size={18} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by load #, driver, route or broker…"
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
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="px">No loads match your search.</p>
      ) : grouped && groups ? (
        groups.map(([driver, dloads]) => {
          const groupTotal = dloads.reduce((s, l) => s + (l.loadRate || 0), 0);
          return (
          <div className="driver-group" key={driver}>
            <div className="dg-head">
              <div className="dg-av">
                {driver.split(" ").map((p) => p[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="dg-name">{driver}</div>
                <div className="dg-meta">
                  {dloads.length} load{dloads.length === 1 ? "" : "s"}
                  {groupTotal > 0 && <> · <span className="dg-total">{money(groupTotal)}</span></>}
                </div>
              </div>
            </div>
            <div className="load-cards">
              {dloads.map((l) => (
                <LoadCard key={l.id} load={l} />
              ))}
            </div>
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
