"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { type EldStatusState, ELD_DUTY_LABELS, fmtEldMin, fmtEldUpdatedAgo } from "@/lib/eld-format";

type EldStatusResponse =
  | { ok: true; state: Exclude<EldStatusState, "available"> }
  | {
      ok: true;
      state: "available";
      dutyStatus: string;
      driveRemainingMin: number | null;
      shiftRemainingMin: number | null;
      cycleRemainingMin: number | null;
      breakRemainingMin: number | null;
      vehicleName: string | null;
      vehicleVin: string | null;
      sourceUpdatedAt: string | null;
      fetchedAt: string;
    };

// Neutral, honest copy for every state except "available" — none of these
// get an action button, because there's nothing a click could actually do
// yet (no ELD provider is wired up — see docs/eld-providers-research.md).
const STATE_COPY: Record<Exclude<EldStatusState, "available">, string> = {
  not_linked: "Not linked to an ELD driver yet.",
  not_connected: "No ELD provider connection saved for this company yet.",
  not_verified: "The saved ELD connection hasn't been verified for HOS access yet.",
  no_data: "Linked, but no HOS data has been synced yet.",
  temporarily_unavailable: "HOS data is temporarily unavailable — try again later.",
};

const NOT_AVAILABLE = "Not available";

// How fresh the provider's own numbers are. Deliberately not a "Live" badge:
// no provider sync cadence is agreed yet (see docs/eld-providers-research.md),
// so this only reports the measured age of the data.
function freshness(iso: string | null): { cls: string; label: string } {
  if (!iso) return { cls: "", label: NOT_AVAILABLE };
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { cls: "", label: NOT_AVAILABLE };
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes <= 15) return { cls: "live", label: fmtEldUpdatedAgo(iso) };
  if (minutes <= 60) return { cls: "", label: fmtEldUpdatedAgo(iso) };
  return { cls: "stale", label: fmtEldUpdatedAgo(iso) };
}

export function EldStatusCard({ email }: { email: string }) {
  const [data, setData] = useState<EldStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/eld-status?email=${encodeURIComponent(email)}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setData(json);
      } catch {
        /* ignore — panel just stays empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  if (loading) return null;
  if (!data) return null;

  return (
    <div className="panel">
      <h3>
        <Activity size={18} /> ELD &amp; HOS
      </h3>

      {data.state !== "available" ? (
        <p className="px" style={{ marginTop: 8 }}>
          {STATE_COPY[data.state]}
        </p>
      ) : (
        (() => {
          // Drive is the number a dispatcher actually acts on (can this driver
          // take another leg right now); Shift/Cycle/Break are context, shown
          // smaller. No color thresholds here — this app doesn't know any
          // provider's actual HOS rules, so it never guesses at a violation.
          const secondary = [
            { label: "Shift", v: data.shiftRemainingMin },
            { label: "Cycle", v: data.cycleRemainingMin },
            { label: "Break", v: data.breakRemainingMin },
          ];
          const fresh = freshness(data.sourceUpdatedAt || data.fetchedAt);

          return (
            <div>
              <div className="dc-eld-duty">
                <span className="dc-eld-status">
                  {ELD_DUTY_LABELS[data.dutyStatus] || data.dutyStatus}
                </span>
                <span className={`dc-eld-conn${fresh.cls ? ` ${fresh.cls}` : ""}`}>{fresh.label}</span>
              </div>

              <div className="dc-eld-drive">
                <label>Drive remaining</label>
                <div className="v">{fmtEldMin(data.driveRemainingMin)}</div>
              </div>

              <div className="dc-eld-grid">
                {secondary.map((c) => (
                  <div key={c.label} className="dc-eld-cell">
                    <label>{c.label}</label>
                    <div className="v">{fmtEldMin(c.v)}</div>
                  </div>
                ))}
              </div>

              <div className="dc-eld-foot">
                <span>
                  {data.vehicleName || NOT_AVAILABLE}
                  {data.vehicleVin ? ` · ${data.vehicleVin}` : ""}
                </span>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
