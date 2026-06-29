"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

type DriverRow = {
  email: string;
  name: string;
  joined: boolean;
  total: number;
  active: number;
  search: string; // lowercased haystack: name, email, load refs, broker names
};

export function DriversList({ drivers }: { drivers: DriverRow[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const shown = query
    ? drivers.filter((d) => d.search.includes(query))
    : drivers;

  async function remove(email: string) {
    setBusy(email);
    try {
      const res = await fetch("/api/driver-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not remove", data.error || "Try again.");
      } else {
        toast("Driver removed", `${email} was removed from your roster.`);
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
    <>
      <div className="driver-search">
        <Search size={18} />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by driver, email, load # or broker…"
        />
        {q && (
          <button type="button" className="ds-clear" onClick={() => setQ("")}>
            ✕
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="px">No drivers match “{q}”.</p>
      ) : (
        <div className="load-list">
          {shown.map((d) => (
            <div key={d.email} className="load-card driver-row-wrap">
              <Link
                href={`/drivers/${encodeURIComponent(d.email)}`}
                className="driver-row-link"
                style={{ textDecoration: "none" }}
              >
                <div className="drv-av" aria-hidden="true">
                  {(d.name || d.email).trim().charAt(0).toUpperCase()}
                </div>
                <div className="lc-main drv-main">
                  <div className="drv-top">
                    <span className="driver-name-lg">{d.name}</span>
                    <span className={`drv-badge ${d.joined ? "ok" : "pending"}`}>
                      {d.joined ? "Active" : "Pending"}
                    </span>
                  </div>
                  <div className="drv-email">{d.email}</div>
                  <div className="drv-chips">
                    <span className="drv-chip"><b>{d.active}</b> active</span>
                    <span className="drv-chip"><b>{d.total}</b> total</span>
                  </div>
                </div>
                <ChevronRight className="drv-chev" />
              </Link>

              {confirm === d.email ? (
                <div className="driver-row-confirm">
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
                  title="Remove driver"
                  aria-label="Remove driver"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
