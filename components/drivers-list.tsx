"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

type DriverRow = {
  email: string;
  name: string;
  joined: boolean;
  total: number;
  active: number;
  search: string; // lowercased haystack: name, email, load refs, broker names
};

export function DriversList({ drivers }: { drivers: DriverRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [sort, setSort] = useState<"" | "name-asc" | "name-desc" | "active">(
    () => (searchParams.get("sort") as "name-asc" | "name-desc" | "active") || ""
  );
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  // Same reason as Active loads: a reload or a back-navigation from a
  // driver's detail page should return to the same search, not reset it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]);

  // Same "/" shortcut as Active loads — ignored while any input already
  // has focus, so it never steals a keystroke mid-typing.
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
  const shown = (() => {
    const filtered = query ? drivers.filter((d) => d.search.includes(query)) : drivers;
    if (sort === "name-asc") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name-desc") return [...filtered].sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "active") return [...filtered].sort((a, b) => b.active - a.active);
    return filtered;
  })();

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
      {query && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {drivers.length} driver{drivers.length === 1 ? "" : "s"}
        </p>
      )}
      <div className="driver-controls">
        <div className="driver-search">
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
            placeholder="Search by driver, email, load # or broker… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>
              ✕
            </button>
          )}
        </div>
        <select
          className="lb-status"
          value={sort}
          onChange={(e) => setSort(e.target.value as "" | "name-asc" | "name-desc" | "active")}
        >
          <option value="">Sort: default</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="active">Most active loads</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching drivers"
          sub={`No drivers match "${q}".`}
          action={
            <button type="button" className="lb-clear-filters" onClick={() => setQ("")}>
              Clear search
            </button>
          }
        />
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
