"use client";

import { useEffect, useState } from "react";
import { Link2, Unlink, Plug } from "lucide-react";
import { useToast } from "@/components/toast";

type Provider = "dat" | "123loadboard" | "truckstop" | "uber_freight";

const PROVIDER_LABELS: Record<Provider, string> = {
  dat: "DAT",
  "123loadboard": "123Loadboard",
  truckstop: "Truckstop",
  uber_freight: "Uber Freight",
};

type Connection = { provider: Provider; status: "credentials_saved" | "disconnected"; updatedAt: string | null };

export function LoadSourceConnectionsForm() {
  const toast = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Provider | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/load-source-connections");
      const data = await res.json();
      if (data.ok) {
        setConnections(data.connections);
        setConfigured(data.configured);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function connect(provider: Provider) {
    const secret = (secrets[provider] || "").trim();
    if (!secret) {
      toast("Enter a value", "Paste the API key or credential first.");
      return;
    }
    setBusy(provider);
    try {
      const res = await fetch("/api/load-source-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, secret }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Connect failed", data.error || "Try again.");
        return;
      }
      setSecrets((s) => ({ ...s, [provider]: "" }));
      toast("Credentials saved", `${PROVIDER_LABELS[provider]} credentials are saved.`);
      await load();
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: Provider) {
    setBusy(provider);
    try {
      const res = await fetch(`/api/load-source-connections?provider=${provider}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Remove failed", data.error || "Try again.");
        return;
      }
      toast("Removed", `${PROVIDER_LABELS[provider]} credentials were removed.`);
      await load();
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="px">Loading…</p>;

  return (
    <div className="panel" style={{ padding: 20 }}>
      <h3>
        <Plug size={18} /> Source connections
      </h3>
      <p className="px">
        Connect your load-board accounts to search from inside LoadSprint. Credentials are encrypted
        before they&apos;re stored — nothing here is used to search loads yet.
      </p>
      {!configured && (
        <p className="px" style={{ color: "var(--warn, #b45309)" }}>
          Not configured on this server yet — connecting is temporarily unavailable.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {connections.map((c) => (
          <div key={c.provider} className="field full" style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{PROVIDER_LABELS[c.provider]}</span>
              <span style={{ fontSize: 12, color: c.status === "credentials_saved" ? "var(--ok, #15803d)" : "var(--muted, #6b7280)" }}>
                {c.status === "credentials_saved" ? "Credentials saved" : "Not connected"}
              </span>
            </label>
            {c.status === "credentials_saved" ? (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 8 }}
                disabled={busy === c.provider}
                onClick={() => disconnect(c.provider)}
              >
                <Unlink size={15} /> {busy === c.provider ? "Removing…" : "Remove"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  type="password"
                  placeholder="API key or credential"
                  value={secrets[c.provider] || ""}
                  onChange={(e) => setSecrets((s) => ({ ...s, [c.provider]: e.target.value }))}
                  disabled={!configured}
                />
                <button
                  className="btn btn-primary"
                  disabled={!configured || busy === c.provider}
                  onClick={() => connect(c.provider)}
                >
                  <Link2 size={15} /> {busy === c.provider ? "Connecting…" : "Connect"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
