"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";
import { useToast } from "@/components/toast";

type NormalizedLoad = {
  provider: string;
  externalId: string;
  origin: string;
  destination: string;
  pickupDate: string | null;
  equipment: string | null;
  trailerLengthFt: number | null;
  miles: number | null;
  deadheadMi: number | null;
  rateCents: number | null;
  ratePerMileCents: number | null;
  broker: { name: string; contact: string } | null;
  originalUrl: string;
};

type SourcesStatus = "no_location" | "no_sources_connected" | "pending_provider_approval" | "ready";

type Result = { loads: NormalizedLoad[]; sourcesStatus: SourcesStatus };

const STATUS_MESSAGE: Record<Exclude<SourcesStatus, "ready">, string> = {
  no_location: "No GPS fix for this driver yet — loads search needs a last-known location.",
  no_sources_connected: "No load-board source connected yet.",
  pending_provider_approval: "Credentials saved, but no provider is approved to search yet.",
};

const PROVIDER_LABELS: Record<string, string> = {
  dat: "DAT",
  "123loadboard": "123Loadboard",
  truckstop: "Truckstop",
  uber_freight: "Uber Freight",
};

const NOT_LISTED = "Not listed";

function fmtMi(v: number | null): string {
  return v == null ? NOT_LISTED : `${v} mi`;
}

function fmtMoney(cents: number | null): string {
  return cents == null ? NOT_LISTED : `$${(cents / 100).toFixed(2)}`;
}

function fmtRpm(cents: number | null): string {
  return cents == null ? NOT_LISTED : `$${(cents / 100).toFixed(2)}/mi`;
}

// Load-board search from a driver's card. Today every call resolves to
// zero loads plus a status explaining why — no adapter is active yet (see
// lib/load-source-adapters) — but the UI is wired for the day one is.
// Hard filters (equipment/trailer/min rate) and the deadhead-then-RPM sort
// happen server-side in lib/load-search.ts; this component only renders
// whatever comes back, and never computes a value the API left null.
export function NearbyLoadsSearch({ email }: { email: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/api/driver-search-profile/nearby-loads?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Search failed", data.error || "Try again.");
        return;
      }
      setResult({ loads: data.loads || [], sourcesStatus: data.sourcesStatus });
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <Search size={18} /> Nearby loads
      </h3>
      <button className="btn btn-primary" onClick={search} disabled={loading}>
        <Search size={15} /> {loading ? "Searching…" : "Find loads nearby"}
      </button>

      {result && result.sourcesStatus !== "ready" && (
        <p className="px" style={{ marginTop: 10 }}>
          {STATUS_MESSAGE[result.sourcesStatus]}
          {result.sourcesStatus === "no_sources_connected" && (
            <>
              {" "}
              <Link href="/load-sources">Connect one</Link>.
            </>
          )}
        </p>
      )}

      {result && result.sourcesStatus === "ready" && result.loads.length === 0 && (
        <p className="px" style={{ marginTop: 10 }}>No loads matched right now.</p>
      )}

      {result && result.loads.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {result.loads.map((l) => (
            <div
              key={`${l.provider}-${l.externalId}`}
              className="field full"
              style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
                  {PROVIDER_LABELS[l.provider] || l.provider}
                </span>
                <a href={l.originalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: "4px 10px" }}>
                  <ExternalLink size={13} /> Open original
                </a>
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{l.origin} → {l.destination}</div>
              <div className="px" style={{ marginTop: 2 }}>
                Pickup: {l.pickupDate || NOT_LISTED} · {l.equipment || NOT_LISTED}
              </div>
              <div className="px">
                {fmtMi(l.miles)} · Deadhead {fmtMi(l.deadheadMi)}
              </div>
              <div className="px">
                Rate {fmtMoney(l.rateCents)} · RPM {fmtRpm(l.ratePerMileCents)}
              </div>
              <div className="px">
                Broker: {l.broker ? `${l.broker.name} — ${l.broker.contact}` : NOT_LISTED}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
