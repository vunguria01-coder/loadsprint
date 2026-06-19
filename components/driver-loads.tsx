"use client";

import Link from "next/link";
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
};

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
      {loads.map((l) => (
        <div key={l.id} className="load-card" style={{ opacity: busy === l.id ? 0.5 : 1 }}>
          <div className="lc-main">
            <div className="lc-top">
              <span className="lc-ref">{l.ref}</span>
              <span className="status-chip">{l.status}</span>
            </div>
            <div className="lc-route">
              {l.originName} → {l.destName}
            </div>
          </div>
          <div className="lc-actions" style={{ display: "flex", gap: 8 }}>
            <Link href={`/loads/${l.id}`} className="btn btn-ghost" style={{ padding: "8px 14px" }}>
              Open
            </Link>
            <button
              className="btn btn-ghost"
              style={{ padding: "8px 12px", color: "#fca5a5" }}
              onClick={() => remove(l.id, l.ref)}
              disabled={busy === l.id}
              aria-label="Delete load"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
