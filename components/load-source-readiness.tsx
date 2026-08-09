"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";

type Provider = "dat" | "123loadboard" | "truckstop" | "uber_freight";

const PROVIDER_LABELS: Record<Provider, string> = {
  dat: "DAT",
  "123loadboard": "123Loadboard",
  truckstop: "Truckstop",
  uber_freight: "Uber Freight",
};

type SourceStatus = {
  provider: Provider;
  credentials: "saved" | "missing";
  writtenPermission: "pending" | "approved";
  adapter: "disabled" | "active";
  allowFetch: boolean;
  allowStore: boolean;
  allowDisplay: boolean;
  cacheTtlSeconds: number;
  lastSuccessAt: string | null;
  nextEligibleAt: string | null;
  loadsFetched: number;
  lastErrorCode: string | null;
  cachedLoadCount: number;
  readiness: "ready" | "pending_approval";
};

function fmtDate(v: string | null): string {
  if (!v) return "Never";
  return new Date(v).toLocaleString();
}

function Pill({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
  return (
    <span style={{ fontSize: 12, color: ok ? "var(--ok, #15803d)" : "var(--muted, #6b7280)" }}>
      {ok ? onLabel : offLabel}
    </span>
  );
}

// Every gate a provider has to clear before it can actually show loads,
// shown independently — "credentials saved" reads as exactly that, never
// as "connected" or "ready." Nothing here is computed client-side; it's a
// direct render of what the tenant-scoped status endpoint returns.
export function LoadSourceReadiness() {
  const [sources, setSources] = useState<SourceStatus[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/load-source-connections/status");
        const data = await res.json();
        if (data.ok) setSources(data.sources);
      } catch {
        /* ignore — panel just stays empty */
      }
    })();
  }, []);

  if (!sources) return null;

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <h3>Source readiness</h3>
      <p className="px">
        Every gate a source needs before it can show loads — independently, so a saved credential never
        reads as more than it is.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {sources.map((s) => (
          <div key={s.provider} className="field full" style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <b>{PROVIDER_LABELS[s.provider]}</b>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                {s.readiness === "ready" ? (
                  <>
                    <ShieldCheck size={14} color="var(--ok, #15803d)" /> Ready
                  </>
                ) : (
                  <>
                    <ShieldAlert size={14} color="var(--muted, #6b7280)" /> Waiting on approval
                  </>
                )}
              </span>
            </div>
            <div className="px" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              <span>Credentials: <Pill ok={s.credentials === "saved"} onLabel="Saved" offLabel="Missing" /></span>
              <span>Written permission: <Pill ok={s.writtenPermission === "approved"} onLabel="Approved" offLabel="Pending" /></span>
              <span>Adapter: <Pill ok={s.adapter === "active"} onLabel="Active" offLabel="Disabled" /></span>
            </div>
            <div className="px" style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              <span>Fetch: <Pill ok={s.allowFetch} onLabel="Allowed" offLabel="Not allowed" /></span>
              <span>Store: <Pill ok={s.allowStore} onLabel="Allowed" offLabel="Not allowed" /></span>
              <span>Display: <Pill ok={s.allowDisplay} onLabel="Allowed" offLabel="Not allowed" /></span>
              <span>Cache TTL: {s.cacheTtlSeconds}s</span>
            </div>
            <div className="px" style={{ marginTop: 4 }}>
              Last successful fetch: {fmtDate(s.lastSuccessAt)} · Next eligible: {fmtDate(s.nextEligibleAt)}
            </div>
            <div className="px">
              Loads fetched last run: {s.loadsFetched}
              {s.lastErrorCode ? ` · Last error: ${s.lastErrorCode}` : ""}
            </div>
            <div className="px">Cached loads on hand: {s.cachedLoadCount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
