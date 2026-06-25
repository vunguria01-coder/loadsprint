"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { LoadView } from "@/lib/load-view";

const STATUSES = ["Assigned", "Picked Up", "In Transit", "At Delivery", "Delivered", "Closed"];

type ListItem = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  docCount: number;
  photoCount: number;
};

const C = {
  bg: "#0B1120",
  card: "#111c30",
  line: "#22304a",
  text: "#E8EEF8",
  muted: "#93A4BE",
  blue: "#2563EB",
  sky: "#38BDF8",
  green: "#16a34a",
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function viewDocument(dataUrl: string) {
  if (dataUrl.startsWith("data:image")) {
    const w = window.open();
    if (w) w.document.write(`<img src="${dataUrl}" style="max-width:100%"/>`);
    return;
  }
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.slice(5, meta.indexOf(";")) || "application/pdf";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    const w = window.open();
    if (w) w.location.href = dataUrl;
  }
}

function downloadDocument(dataUrl: string, name: string) {
  try {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    viewDocument(dataUrl);
  }
}

// Open the phone's navigation. Google Maps link works on Android and iOS
// (opens the app if installed, otherwise the browser).
function navigateTo(address: string) {
  const q = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`, "_blank");
}
function navigateRoute(origin: string, dest: string) {
  const o = encodeURIComponent(origin);
  const d = encodeURIComponent(dest);
  window.open(`https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`, "_blank");
}
// Trucker Path is the most common truck-specific nav app among US drivers.
function navigateTruck(address: string) {
  const q = encodeURIComponent(address);
  // Try the truck app; fall back to Google Maps if it isn't installed.
  const t = Date.now();
  window.location.href = `truckerpath://search?q=${q}`;
  setTimeout(() => {
    if (Date.now() - t < 1600) navigateTo(address);
  }, 1200);
}

type Notif = { id: string; text: string; loadRef: string; createdAt: string; read: boolean };

export function DriverApp({ name }: { name: string }) {
  const [list, setList] = useState<ListItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/my-loads");
      const data = await res.json();
      if (data.ok) setList(data.loads);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.ok) setNotifs(data.items || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchNotifs();
    const t = setInterval(() => { fetchList(); fetchNotifs(); }, 15000);
    return () => clearInterval(t);
  }, [fetchList, fetchNotifs]);

  async function markRead() {
    try { await fetch("/api/notifications", { method: "POST" }); } catch {}
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  }

  // Make the phone's hardware/browser Back button close an open load and return
  // to the list, instead of leaving the app and forcing a fresh sign-in.
  useEffect(() => {
    function onPop() {
      setOpenId(null);
      fetchList();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [fetchList]);

  function openLoad(id: string) {
    // Add a history entry so Back pops back to the list rather than the site.
    window.history.pushState({ load: id }, "");
    setOpenId(id);
  }

  const unread = notifs.filter((n) => !n.read);

  if (openId) {
    return <DriverLoad loadId={openId} onBack={() => window.history.back()} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          Load<span style={{ color: C.sky }}>Sprint</span>
        </div>
        <button
          onClick={async () => {
            try { await fetch("/api/logout", { method: "POST" }); } catch {}
            window.location.href = "/driver";
          }}
          style={{ background: "none", border: "none", color: C.sky, fontWeight: 600, fontSize: 15 }}
        >
          Sign out
        </button>
      </div>
      <div style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>
        Hi {name?.split(" ")[0] || "driver"} — your loads
      </div>

      {unread.length > 0 && (
        <div style={{ background: "rgba(56,189,248,0.08)", border: `1px solid ${C.sky}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: C.sky }}>🔔 {unread.length} new</span>
            <button onClick={markRead} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, fontWeight: 600 }}>
              Mark read
            </button>
          </div>
          {unread.slice(0, 5).map((n) => (
            <div key={n.id} style={{ fontSize: 14, padding: "4px 0", color: C.text }}>
              <b style={{ color: C.sky }}>{n.loadRef}</b> — {n.text}
            </div>
          ))}
        </div>
      )}

      {!list ? (
        <div style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>No loads assigned yet.</div>
      ) : (
        list.map((l) => (
          <button
            key={l.id}
            onClick={() => openLoad(l.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", background: C.card,
              border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 12, color: C.text,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: 0.5 }}>{l.ref}</span>
              <Pill status={l.status} />
            </div>
            <div style={{ fontSize: 16 }}>{l.originName} → {l.destName}</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
              {l.docCount} files · {l.photoCount} photos
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function Pill({ status }: { status: string }) {
  return (
    <span style={{
      background: "rgba(56,189,248,0.12)", border: `1px solid ${C.sky}`, color: C.sky,
      borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

function DriverLoad({ loadId, onBack }: { loadId: string; onBack: () => void }) {
  const [load, setLoad] = useState<LoadView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const podInput = useRef<HTMLInputElement>(null);

  const fetchLoad = useCallback(async () => {
    try {
      const res = await fetch(`/api/loads/${loadId}`);
      const data = await res.json();
      if (data.ok) setLoad(data.load);
    } catch {
      /* ignore */
    }
  }, [loadId]);

  useEffect(() => {
    fetchLoad();
    const t = setInterval(fetchLoad, 6000);
    return () => clearInterval(t);
  }, [fetchLoad]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/loads/${loadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) setLoad(data.load);
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>, kind: "photo" | "pod") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (kind === "photo") {
      await act({ action: "photo", phase: "in_transit", dataUrl });
    } else {
      await act({ action: "document", docType: "pod", name: "POD.jpg", dataUrl });
      await act({ action: "status", status: "Delivered" });
    }
  }

  if (!load) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.muted, padding: 24 }}>Loading…</div>
    );
  }

  const btn = {
    width: "100%", padding: 16, borderRadius: 14, fontSize: 16, fontWeight: 700,
    border: "none", color: "#fff", marginTop: 10,
  } as const;

  const navBtn = {
    width: "100%", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700,
    border: "none", cursor: "pointer",
  } as const;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: 16, paddingBottom: 40 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.sky, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
        ‹ My loads
      </button>

      <div style={{ fontSize: 22, fontWeight: 800 }}>{load.ref}</div>
      <div style={{ fontSize: 16, marginTop: 4 }}>{load.originName} → {load.destName}</div>
      <div style={{ marginTop: 8 }}><Pill status={load.status} /></div>

      {/* Navigation */}
      <Section title="Navigation" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => navigateTo(load.originName)}
          style={{ ...navBtn, background: C.blue, color: "#fff" }}
        >
          🧭 Navigate to pickup
        </button>
        <button
          onClick={() => navigateTo(load.destName)}
          style={{ ...navBtn, background: C.blue, color: "#fff" }}
        >
          🧭 Navigate to delivery
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigateRoute(load.originName, load.destName)}
            style={{ ...navBtn, flex: 1, background: C.card, color: C.text, border: `1px solid ${C.line}` }}
          >
            Full route
          </button>
          <button
            onClick={() => navigateTruck(load.destName)}
            style={{ ...navBtn, flex: 1, background: C.card, color: C.text, border: `1px solid ${C.line}` }}
          >
            🚛 Truck app
          </button>
        </div>
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.4 }}>
          “Truck app” opens Trucker Path (truck‑legal routing) if installed, otherwise Google Maps.
        </div>
      </div>

      {/* Files from dispatcher */}
      <Section title="Files from dispatcher" />
      {load.documents.length === 0 ? (
        <Muted>No files yet.</Muted>
      ) : (
        load.documents.map((d) => (
          <div
            key={d.id}
            style={{
              background: C.card, border: `1px solid ${C.line}`, borderRadius: 12,
              padding: 14, marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text, wordBreak: "break-word" }}>📄 {d.name}</span>
              <span style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{d.type.replace("_", " ")}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => viewDocument(d.dataUrl)}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.text, fontWeight: 600, fontSize: 14 }}
              >
                View
              </button>
              <button
                onClick={() => downloadDocument(d.dataUrl, d.name)}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", background: C.blue, color: "#fff", fontWeight: 700, fontSize: 14 }}
              >
                ⤓ Download
              </button>
            </div>
          </div>
        ))
      )}

      {/* Take photo */}
      <Section title="Take a photo" />
      <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e, "photo")} />
      <button style={{ ...btn, background: C.blue }} disabled={busy} onClick={() => photoInput.current?.click()}>
        📷 Take &amp; send photo
      </button>

      {load.photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {load.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.dataUrl} alt="" onClick={() => viewDocument(p.dataUrl)}
              style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}` }} />
          ))}
        </div>
      )}

      {/* Status */}
      <Section title="Update status" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {STATUSES.map((s) => (
          <button key={s} disabled={busy} onClick={() => act({ action: "status", status: s })}
            style={{
              padding: "11px 14px", borderRadius: 999, fontSize: 14, fontWeight: 600,
              border: `1px solid ${load.status === s ? C.blue : C.line}`,
              background: load.status === s ? C.blue : C.card,
              color: load.status === s ? "#fff" : C.muted,
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* POD / deliver */}
      <Section title="Close out delivery" />
      <input ref={podInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e, "pod")} />
      <button style={{ ...btn, background: C.green, border: `1px solid ${C.green}` }} disabled={busy} onClick={() => podInput.current?.click()}>
        ✓ Delivered + photo of paperwork (POD)
      </button>

      {/* Chat */}
      <Section title="Chat with dispatcher" />
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, maxHeight: 220, overflowY: "auto" }}>
        {load.messages.length === 0 ? (
          <Muted>No messages yet.</Muted>
        ) : (
          load.messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.muted }}>{m.authorName} · {m.authorRole}</div>
              {m.text && <div style={{ fontSize: 15 }}>{m.text}</div>}
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Message…"
          style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${C.line}`, background: "#0a1424", color: "#fff", fontSize: 15 }}
        />
        <button
          disabled={busy || !msg.trim()}
          onClick={async () => { const t = msg.trim(); if (!t) return; setMsg(""); await act({ action: "message", text: t }); }}
          style={{ padding: "0 18px", borderRadius: 12, border: "none", background: C.blue, color: "#fff", fontWeight: 700 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <div style={{ fontWeight: 700, fontSize: 15, marginTop: 26, marginBottom: 10, color: "#fff" }}>{title}</div>;
}
function Muted({ children }: { children: ReactNode }) {
  return <div style={{ color: C.muted, fontSize: 14 }}>{children}</div>;
}
