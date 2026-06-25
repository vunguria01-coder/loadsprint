"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";

type Item = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  remainingMeters?: number;
  etaSeconds?: number;
};

const DONE = ["Delivered", "Closed"];

function fmtRemaining(meters?: number, etaSeconds?: number): string | null {
  if (typeof meters !== "number" || typeof etaSeconds !== "number") return null;
  const miles = Math.round(meters / 1609.34);
  const eta = new Date(Date.now() + etaSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${miles} mi left · ETA ~${eta}`;
}

export function DriverLoads({ loads }: { loads: Item[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string, ref: string) {
    if (!confirm(`Delete load ${ref}? This cannot be undone.`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/loads/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Delete failed", data.error || "Try again.");
      else {
        toast("Deleted", `${ref} removed.`);
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loads.length === 0) {
    return <p className="px">No loads yet for this driver. Create one below.</p>;
  }

  return (
    <div className="load-list">
      {loads.map((l) => {
        const remaining = fmtRemaining(l.remainingMeters, l.etaSeconds);
        const active = !DONE.includes(l.status);
        return (
          <div
            key={l.id}
            className="load-card load-card-click"
            style={{ opacity: busy === l.id ? 0.5 : 1, cursor: "pointer" }}
            onClick={() => router.push(`/loads/${l.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(`/loads/${l.id}`);
            }}
          >
            <div className="lc-main">
              <div className="lc-top">
                <span className="lc-ref">{l.ref}</span>
                <span className="status-chip">{l.status}</span>
              </div>
              <div className="lc-route">
                {l.originName} → {l.destName}
              </div>
              {active && remaining && (
                <div className="lc-remaining">🚛 {remaining}</div>
              )}
              {active && !remaining && (
                <div className="lc-remaining muted">Route not built yet</div>
              )}
            </div>
            <div className="lc-actions" style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: "8px 12px", color: "#fca5a5" }}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(l.id, l.ref);
                }}
                disabled={busy === l.id}
                aria-label="Delete load"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
