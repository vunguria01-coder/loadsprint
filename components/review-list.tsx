"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Image as ImageIcon, FileText, PackageCheck } from "lucide-react";
import type { Load } from "@/lib/loads";
import { BrokerPackage } from "@/components/broker-package";
import { EmptyState } from "@/components/empty-state";

export function ReviewList({ loads }: { loads: Load[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");

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
    ? loads.filter((l) =>
        [l.ref, l.originName, l.destName, l.driverName, l.driverEmail]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(query))
      )
    : loads;

  const groups = new Map<string, { name: string; loads: Load[] }>();
  for (const l of shown) {
    const key = (l.driverEmail || "unknown").toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: l.driverName || l.driverEmail || "Unknown driver", loads: [] });
    groups.get(key)!.loads.push(l);
  }
  const driverGroups = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {query && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {loads.length} completed load{loads.length === 1 ? "" : "s"}
        </p>
      )}
      <div className="driver-search" style={{ marginBottom: 20 }}>
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
          placeholder="Search by load #, route or driver… (press /)"
        />
        {q && (
          <button type="button" className="ds-clear" onClick={() => setQ("")}>
            ✕
          </button>
        )}
      </div>

      {driverGroups.length === 0 ? (
        <EmptyState
          icon={query ? <Search size={26} /> : <PackageCheck size={26} />}
          title={query ? "No matching loads" : "No completed loads yet"}
          sub={query ? `No completed loads match "${q}".` : "Delivered and closed loads will appear here for review."}
          action={
            query ? (
              <button type="button" className="lb-clear-filters" onClick={() => setQ("")}>
                Clear search
              </button>
            ) : undefined
          }
        />
      ) : (
        driverGroups.map((g) => (
          <div key={g.name} className="rev-group">
            <div className="rev-driver">
              {g.name}
              <span className="rev-count">{g.loads.length} load{g.loads.length === 1 ? "" : "s"}</span>
            </div>
            <div className="load-list">
              {g.loads.map((l) => (
                <div key={l.id} className="rev-card">
                  <Link href={`/loads/${l.id}`} className="rev-main" style={{ textDecoration: "none" }}>
                    <div className="lc-top">
                      <span className="lc-ref">{l.ref}</span>
                      <span className="status-chip">{l.status}</span>
                      {typeof l.loadRate === "number" && (
                        <span className="rev-price">${l.loadRate.toLocaleString("en-US")}</span>
                      )}
                    </div>
                    <div className="lc-route">{l.originName} → {l.destName}</div>
                    <div className="rev-meta">
                      <span><ImageIcon size={14} /> {l.photos?.length || 0} photos</span>
                      <span><FileText size={14} /> {l.documents?.length || 0} docs</span>
                    </div>
                  </Link>
                  <BrokerPackage loadId={l.id} loadRef={l.ref} compact />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
