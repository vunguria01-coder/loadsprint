"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

type Row = {
  id: string;
  name: string;
  email: string;
  count: number;
  total: number;
  deliveredTotal: number;
  pct: number;
  earned: number;
};

function money(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export function TeamStats({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  // Local editable copy of percentages, keyed by dispatcher id.
  const [pcts, setPcts] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.id, String(r.pct)]))
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function save(id: string) {
    const raw = pcts[id];
    let value = Number(raw);
    if (!Number.isFinite(value)) value = 0;
    value = Math.max(0, Math.min(100, value));
    setBusy(id);
    try {
      const res = await fetch("/api/dispatcher-commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pct: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not save", data.error || "Try again.");
      } else {
        setPcts((p) => ({ ...p, [id]: String(data.pct) }));
        toast("Saved", "Commission updated.");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const grandCount = rows.reduce((s, r) => s + r.count, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandEarned = rows.reduce((s, r) => s + r.earned, 0);

  return (
    <div className="stat-table comm-table">
      <div className="stat-row comm-row stat-head">
        <span>Dispatcher</span>
        <span className="stat-num">Loads</span>
        <span className="stat-num">Delivered $</span>
        <span className="stat-num">%</span>
        <span className="stat-num">Earned</span>
      </div>

      {rows.map((r) => (
        <div className="stat-row comm-row" key={r.id}>
          <span>
            <b>{r.name}</b>
            <i className="stat-mail">{r.email}</i>
          </span>
          <span className="stat-num">{r.count}</span>
          <span className="stat-num">{money(r.deliveredTotal)}</span>
          <span className="stat-num comm-pct">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={pcts[r.id] ?? ""}
              onChange={(e) => setPcts((p) => ({ ...p, [r.id]: e.target.value }))}
              onBlur={() => {
                if (String(Number(pcts[r.id])) !== String(r.pct)) save(r.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              disabled={busy === r.id}
            />
            <span className="comm-sign">%</span>
          </span>
          <span className="stat-num comm-earned">
            {money(Math.round((r.deliveredTotal * (Number(pcts[r.id]) || 0)) / 100))}
          </span>
        </div>
      ))}

      <div className="stat-row comm-row stat-total">
        <span>All dispatchers</span>
        <span className="stat-num">{grandCount}</span>
        <span className="stat-num">{money(grandTotal)}</span>
        <span className="stat-num">—</span>
        <span className="stat-num">{money(grandEarned)}</span>
      </div>
    </div>
  );
}
