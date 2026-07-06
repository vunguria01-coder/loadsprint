"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { money } from "@/lib/format";

export type Receivable = {
  id: string;
  ref: string;
  broker: string;
  route: string;
  amount: number;
  since: string; // ISO — delivered date (or created)
};

function daysBetween(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// Accounts-receivable: delivered loads the broker hasn't paid for yet, with an
// aging breakdown and a one-tap "Mark paid".
export function Receivables({ items }: { items: Receivable[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const { total, b0, b30, b60 } = useMemo(() => {
    let total = 0, b0 = 0, b30 = 0, b60 = 0;
    for (const r of items) {
      total += r.amount;
      const d = daysBetween(r.since);
      if (d <= 30) b0 += r.amount;
      else if (d <= 60) b30 += r.amount;
      else b60 += r.amount;
    }
    return { total, b0, b30, b60 };
  }, [items]);

  async function markPaid(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/loads/${id}/broker-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) toast("Couldn't update", data.error || "Try again.");
      else {
        toast("Marked paid", "Removed from receivables.");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="ins-section">
        <h3>Receivables</h3>
        <p className="ins-sub">Delivered loads brokers still owe you for.</p>
        <div className="home-empty"><p>All caught up — no outstanding broker payments. 🎉</p></div>
      </div>
    );
  }

  return (
    <div className="ins-section">
      <h3>Receivables <span className="count" style={{ marginLeft: 6 }}>{items.length}</span></h3>
      <p className="ins-sub">Delivered loads brokers still owe you for, by how long they&apos;ve been outstanding.</p>

      <div className="ar-aging">
        <div className="ar-age"><span className="ar-age-l">Outstanding</span><span className="ar-age-v">{money(total)}</span></div>
        <div className="ar-age"><span className="ar-age-l">0–30 days</span><span className="ar-age-v">{money(b0)}</span></div>
        <div className="ar-age"><span className="ar-age-l">31–60 days</span><span className="ar-age-v warn">{money(b30)}</span></div>
        <div className="ar-age"><span className="ar-age-l">60+ days</span><span className="ar-age-v bad">{money(b60)}</span></div>
      </div>

      <div className="table-wrap">
        <table className="rep-table">
          <thead>
            <tr>
              <th>Load</th>
              <th>Broker</th>
              <th>Amount</th>
              <th>Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const d = daysBetween(r.since);
              const cls = d <= 30 ? "" : d <= 60 ? "warn" : "bad";
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.ref}</div>
                    <div className="px" style={{ fontSize: 12 }}>{r.route}</div>
                  </td>
                  <td>{r.broker}</td>
                  <td>{money(r.amount)}</td>
                  <td><span className={`ar-days ${cls}`}>{d} day{d === 1 ? "" : "s"}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-primary btn-sm" onClick={() => markPaid(r.id)} disabled={busy === r.id}>
                      {busy === r.id ? "…" : "Mark paid"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
