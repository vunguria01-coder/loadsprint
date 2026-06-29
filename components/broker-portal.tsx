"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Doc = { name: string; type: string; dataUrl: string };
type Photo = { id: string; caption: string; dataUrl: string };
type Data = {
  ok: boolean;
  ref: string;
  status: string;
  progress: number;
  originName: string;
  destName: string;
  point: { lat: number; lng: number };
  locationUpdatedAt: string;
  paused: boolean;
  pausedLabel: string;
  published: boolean;
  driverName?: string;
  confirmation?: { name: string; dataUrl: string } | null;
  photos?: Photo[];
  documents?: Doc[];
  invoice?: unknown;
};

function osmSrc(lat: number, lng: number) {
  const dLat = 0.04;
  const dLng = 0.07;
  const bbox = `${lng - dLng}%2C${lat - dLat}%2C${lng + dLng}%2C${lat + dLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

export function BrokerPortal({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const codeRef = useRef("");
  const STORE_KEY = `bp_code_${token}`;

  const call = useCallback(
    async (full: boolean) => {
      const res = await fetch(`/api/b/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeRef.current, full }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Error");
      }
      return (await res.json()) as Data;
    },
    [token]
  );

  // Authenticate with a given code, remember it so the broker only enters it once.
  const authWith = useCallback(
    async (value: string) => {
      codeRef.current = value.trim().toUpperCase();
      const res = await fetch(`/api/b/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeRef.current, full: true }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Error");
      }
      const d = (await res.json()) as Data;
      setData(d);
      setAuthed(true);
      try {
        localStorage.setItem(STORE_KEY, codeRef.current);
      } catch {
        /* storage unavailable — they'll just re-enter next time */
      }
    },
    [token, STORE_KEY]
  );

  // On first load, reuse a previously-entered code so the broker isn't asked again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(STORE_KEY);
      } catch {
        saved = null;
      }
      if (saved) {
        try {
          await authWith(saved);
        } catch {
          // Code no longer valid (e.g. dispatcher rotated it) — forget it.
          try {
            localStorage.removeItem(STORE_KEY);
          } catch {
            /* ignore */
          }
        }
      }
      if (!cancelled) setInitializing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [STORE_KEY, authWith]);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      await authWith(code);
    } catch (e) {
      setErr(
        e instanceof Error && e.message === "Wrong code"
          ? "Wrong code — check with your dispatcher."
          : "Could not open. Check the code."
      );
    } finally {
      setBusy(false);
    }
  }

  // Poll status + location while viewing.
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(async () => {
      try {
        const d = await call(false);
        setData((prev) => (prev ? { ...prev, ...d } : d));
      } catch {
        /* ignore poll errors */
      }
    }, 6000);
    return () => clearInterval(t);
  }, [authed, call]);

  if (initializing) {
    return (
      <div className="bp-shell">
        <div className="bp-card bp-gate">
          <div className="bp-logo">LoadSprint</div>
          <p className="bp-sub">Opening…</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="bp-shell">
        <div className="bp-card bp-gate">
          <div className="bp-logo">LoadSprint</div>
          <h1>Track this load</h1>
          <p className="bp-sub">Enter the access code your dispatcher sent you.</p>
          {err && <div className="bp-err">{err}</div>}
          <input
            className="bp-code-input"
            placeholder="Access code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoCapitalize="characters"
            maxLength={8}
          />
          <button className="bp-btn" onClick={submit} disabled={busy || !code.trim()}>
            {busy ? "Opening…" : "View load"}
          </button>
        </div>
      </div>
    );
  }

  const d = data!;
  return (
    <div className="bp-shell">
      <div className="bp-main">
        <div className="bp-head">
          <div className="bp-logo">LoadSprint</div>
          <div className="bp-ref">{d.ref}</div>
          <div className="bp-route">{d.originName} → {d.destName}</div>
          <div className={`bp-status bp-${d.status.replace(/\s/g, "").toLowerCase()}`}>{d.status}</div>
        </div>

        {/* Live location */}
        <section className="bp-card">
          <h2>Driver location</h2>
          {d.paused && <div className="bp-note">{d.pausedLabel}</div>}
          <div className="bp-map">
            <iframe
              title="Driver location"
              src={osmSrc(d.point.lat, d.point.lng)}
              style={{ width: "100%", height: 300, border: 0, borderRadius: 12 }}
            />
          </div>
          <div className="bp-map-row">
            <span className="bp-sub">Updated {fmtTime(d.locationUpdatedAt)}</span>
            <a
              className="bp-link"
              href={`https://www.google.com/maps?q=${d.point.lat},${d.point.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
        </section>

        {/* Rate confirmation */}
        {d.confirmation && (
          <section className="bp-card">
            <h2>Rate confirmation</h2>
            <a className="bp-doc" href={d.confirmation.dataUrl} target="_blank" rel="noopener noreferrer" download={d.confirmation.name}>
              📄 {d.confirmation.name}
              <span className="bp-doc-act">View / download</span>
            </a>
          </section>
        )}

        {/* Photos chosen by the dispatcher */}
        {d.photos && d.photos.length > 0 && (
          <section className="bp-card">
            <h2>Photos</h2>
            <div className="bp-photos">
              {d.photos.map((p) => (
                <a key={p.id} href={p.dataUrl} target="_blank" rel="noopener noreferrer" className="bp-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={p.caption || "Load photo"} />
                  {p.caption && <span>{p.caption}</span>}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Final documents — only after the dispatcher sends them */}
        {d.published ? (
          (d.documents && d.documents.length > 0) ? (
            <section className="bp-card">
              <h2>Documents</h2>
              <div className="bp-docs">
                {d.documents.map((doc, i) => (
                  <a key={i} className="bp-doc" href={doc.dataUrl} target="_blank" rel="noopener noreferrer" download={doc.name}>
                    📎 {doc.name}
                    <span className="bp-doc-act">View / download</span>
                  </a>
                ))}
              </div>
            </section>
          ) : (
            <section className="bp-card">
              <h2>Documents</h2>
              <p className="bp-sub">No additional documents were attached.</p>
            </section>
          )
        ) : (
          <section className="bp-card bp-pending">
            <h2>Documents</h2>
            <p className="bp-sub">Final paperwork and the invoice will appear here once the dispatcher sends them.</p>
          </section>
        )}

        <div className="bp-foot">Powered by LoadSprint</div>
      </div>
    </div>
  );
}
