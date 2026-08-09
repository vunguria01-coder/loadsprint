"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type EldStatusState = "not_linked" | "not_connected" | "not_verified" | "no_data" | "available" | "temporarily_unavailable";

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

const DUTY_STATUS_LABELS: Record<string, string> = {
  off_duty: "Off duty",
  sleeper: "Sleeper berth",
  driving: "Driving",
  on_duty: "On duty",
  yard_move: "Yard move",
  personal_conveyance: "Personal conveyance",
  unknown: "Unknown",
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

function fmtMin(v: number | null): string {
  if (v == null) return NOT_AVAILABLE;
  const h = Math.floor(v / 60);
  const m = v % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Deliberately exact, not a vague "Live" badge — the real sync cadence
// isn't agreed with any provider yet (see the ELD research doc), so this
// only ever states what's actually known: when it was last updated.
function fmtUpdatedAgo(iso: string | null): string {
  if (!iso) return NOT_AVAILABLE;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return NOT_AVAILABLE;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
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
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{DUTY_STATUS_LABELS[data.dutyStatus] || data.dutyStatus}</div>
          <div className="fgrid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Drive remaining</label>
              <div>{fmtMin(data.driveRemainingMin)}</div>
            </div>
            <div className="field">
              <label>Shift remaining</label>
              <div>{fmtMin(data.shiftRemainingMin)}</div>
            </div>
            <div className="field">
              <label>Cycle remaining</label>
              <div>{fmtMin(data.cycleRemainingMin)}</div>
            </div>
            <div className="field">
              <label>Break remaining</label>
              <div>{fmtMin(data.breakRemainingMin)}</div>
            </div>
          </div>
          <p className="px" style={{ marginTop: 10 }}>
            {data.vehicleName || NOT_AVAILABLE}
            {data.vehicleVin ? ` (${data.vehicleVin})` : ""} · {fmtUpdatedAgo(data.sourceUpdatedAt || data.fetchedAt)}
          </p>
        </div>
      )}
    </div>
  );
}
