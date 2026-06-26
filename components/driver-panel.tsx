"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, History, Trash2 } from "lucide-react";

type HistoryLoad = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  rate?: number;
};

export function DriverPanel({
  name,
  stats,
  history,
}: {
  name: string;
  stats: { total: number; completed: number; active: number; earnings: number };
  history: HistoryLoad[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(history);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function removePaid(id: string) {
    if (!confirm("Delete this paid load permanently? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/loads/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((l) => l.id !== id));
        router.refresh();
      } else {
        alert("Could not delete this load.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  const money = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <>
      <button type="button" className="dp-open" onClick={() => setOpen(true)}>
        <History size={17} /> Driver history
      </button>

      {open && <div className="dp-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`dp-panel${open ? " open" : ""}`}>
        <div className="dp-head">
          <div>
            <div className="dp-eyebrow">Driver</div>
            <div className="dp-name">{name}</div>
          </div>
          <button type="button" className="dp-x" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="dp-stats">
          <div className="dp-stat">
            <span>{stats.total}</span>
            <label>Total loads</label>
          </div>
          <div className="dp-stat">
            <span>{stats.completed}</span>
            <label>Completed</label>
          </div>
          <div className="dp-stat">
            <span>{stats.active}</span>
            <label>Active</label>
          </div>
          <div className="dp-stat">
            <span>{money(stats.earnings)}</span>
            <label>Earnings</label>
          </div>
        </div>

        <div className="dp-section">History</div>
        {items.length === 0 ? (
          <p className="px" style={{ padding: "0 18px" }}>No completed loads yet.</p>
        ) : (
          <div className="dp-list">
            {items.map((l) => (
              <div key={l.id} className="dp-item">
                <div className="dp-item-main">
                  <div className="dp-ref">
                    {l.ref}
                    <span className={`dp-badge ${l.status === "Closed" ? "paid" : ""}`}>
                      {l.status}
                    </span>
                  </div>
                  <div className="dp-route">
                    {l.originName} → {l.destName}
                  </div>
                  {typeof l.rate === "number" && l.rate > 0 && (
                    <div className="dp-rate">{money(l.rate)}</div>
                  )}
                </div>
                {l.status === "Closed" && (
                  <button
                    type="button"
                    className="dp-del"
                    disabled={busyId === l.id}
                    onClick={() => removePaid(l.id)}
                    title="Delete paid load"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
