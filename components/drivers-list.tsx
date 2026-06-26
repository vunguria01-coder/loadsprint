"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

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
  const query = q.trim().toLowerCase();
  const shown = query
    ? drivers.filter((d) => d.search.includes(query))
    : drivers;

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
            <Link
              key={d.email}
              href={`/drivers/${encodeURIComponent(d.email)}`}
              className="load-card"
              style={{ textDecoration: "none" }}
            >
              <div className="lc-main">
                <div className="driver-name-lg">{d.name}</div>
                <div className="lc-route">{d.email}</div>
                <div className="px" style={{ marginTop: 4 }}>
                  {d.active} active · {d.total} total {d.joined ? "" : "· invite pending"}
                </div>
              </div>
              <ChevronRight />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
