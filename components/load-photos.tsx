"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { fileToDataUrl } from "@/lib/format";

const PHASES: { key: string; label: string }[] = [
  { key: "before_pickup", label: "Before pickup" },
  { key: "in_transit", label: "During transit" },
  { key: "at_delivery", label: "At delivery" },
];

export function LoadPhotos({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [phase, setPhase] = useState("before_pickup");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await mutate({ action: "photo", phase, dataUrl, caption: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <Camera /> Cargo photos
      </h3>
      <p className="px">Captured before pickup, in transit, and at delivery.</p>

      {PHASES.map((p) => {
        const photos = load.photos.filter((ph) => ph.phase === p.key);
        return (
          <div key={p.key}>
            <div className="gal-phase">{p.label}</div>
            <div className="gal">
              {photos.length === 0 && <div className="empty-mini">No photos yet.</div>}
              {photos.map((ph) => (
                <img
                  key={ph.id}
                  src={ph.dataUrl}
                  alt={p.label}
                  onClick={() => setOpen(ph.dataUrl)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="uploader">
        <select value={phase} onChange={(e) => setPhase(e.target.value)}>
          {PHASES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="file">
          {busy ? "Uploading…" : "Add photo"}
          <input type="file" accept="image/*" onChange={onFile} disabled={busy} />
        </label>
      </div>

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>Photo</b>
              <button onClick={() => setOpen(null)}>Close ✕</button>
            </div>
            <img src={open} alt="Cargo" />
          </div>
        </div>
      )}
    </div>
  );
}
