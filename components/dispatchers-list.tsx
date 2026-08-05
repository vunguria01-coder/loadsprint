"use client";

import { useEffect, useRef, useState } from "react";
import { UserCircle, Trash2, Search } from "lucide-react";
import { useToast } from "@/components/toast";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";

type DispatcherRow = {
  email: string;
  name: string;
  joined: boolean;
};

export function DispatchersList({ dispatchers }: { dispatchers: DispatcherRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = q.trim().toLowerCase();
  const shown = query
    ? dispatchers.filter(
        (d) => d.name.toLowerCase().includes(query) || d.email.toLowerCase().includes(query)
      )
    : dispatchers;

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
    <div>
      {query && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {dispatchers.length} members
        </p>
      )}
      {dispatchers.length > 1 && (
        <div className="driver-search" style={{ marginBottom: 16 }}>
          <Search size={18} />
          <input
            ref={searchRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              if (q) setQ("");
              else (e.target as HTMLInputElement).blur();
            }}
            placeholder="Search by name or email… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>
              ✕
            </button>
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching dispatchers"
          sub={`No dispatchers match "${q}".`}
          action={
            <button type="button" className="lb-clear-filters" onClick={() => setQ("")}>
              Clear search
            </button>
          }
        />
      ) : (
        <div className="load-list">
          {shown.map((d) => (
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
      )}
    </div>
  );
}
