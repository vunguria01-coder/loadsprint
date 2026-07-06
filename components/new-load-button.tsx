"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, ChevronRight } from "lucide-react";

type DriverOpt = { email: string; name: string };

// Global "New load" entry point. Load creation lives on a driver's page, so this
// opens a quick driver picker and routes to that driver's create-load form —
// no more hunting through the Drivers list first.
export function NewLoadButton({
  drivers,
  variant = "primary",
}: {
  drivers: DriverOpt[];
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const shown = query
    ? drivers.filter((d) => d.name.toLowerCase().includes(query) || d.email.includes(query))
    : drivers;

  function pick(email: string) {
    setOpen(false);
    router.push(`/drivers/${encodeURIComponent(email)}#new-load`);
  }

  return (
    <>
      <button
        className={`btn ${variant === "ghost" ? "btn-ghost" : "btn-primary"}`}
        onClick={() => {
          if (drivers.length === 0) {
            router.push("/drivers");
            return;
          }
          setOpen(true);
        }}
      >
        <Plus size={17} /> New load
      </button>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="box nl-box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>New load — pick a driver</b>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="nl-body">
              <div className="driver-search" style={{ marginBottom: 12 }}>
                <Search size={18} />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search drivers…"
                />
                {q && <button type="button" className="ds-clear" onClick={() => setQ("")}>✕</button>}
              </div>
              <div className="nl-list">
                {shown.length === 0 ? (
                  <div className="nl-empty">No drivers match “{q}”.</div>
                ) : (
                  shown.map((d) => (
                    <button key={d.email} className="nl-row" onClick={() => pick(d.email)}>
                      <div className="nl-av">{(d.name || d.email).trim().charAt(0).toUpperCase()}</div>
                      <div className="nl-info">
                        <div className="nl-name">{d.name}</div>
                        <div className="nl-email">{d.email}</div>
                      </div>
                      <ChevronRight size={17} className="nl-chev" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
