"use client";

import { useState } from "react";
import { UserCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { useRouter } from "next/navigation";

type DispatcherRow = {
  email: string;
  name: string;
  joined: boolean;
};

export function DispatchersList({ dispatchers }: { dispatchers: DispatcherRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function remove(email: string) {
    setBusy(email);
    try {
      const res = await fetch("/api/dispatcher-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not remove", data.error || "Try again.");
      } else {
        toast("Dispatcher removed", `${email} no longer has access.`);
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <div className="load-list">
      {dispatchers.map((d) => (
        <div key={d.email} className="load-card" style={{ cursor: "default" }}>
          <div className="lc-main">
            <div className="driver-name-lg">
              <UserCircle size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {d.name}
            </div>
            <div className="lc-route">{d.email}</div>
            <div className="px" style={{ marginTop: 4 }}>
              {d.joined ? "Active" : "Invite pending"}
            </div>
          </div>
          {confirm === d.email ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => remove(d.email)}
                disabled={busy === d.email}
              >
                {busy === d.email ? "…" : "Confirm"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="row-del"
              onClick={() => setConfirm(d.email)}
              title="Remove dispatcher"
              aria-label="Remove dispatcher"
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
