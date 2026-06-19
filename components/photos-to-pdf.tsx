"use client";

import { useState } from "react";
import { FileImage, Download } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { loadJsPDF, type JsPDFDoc } from "@/components/use-jspdf";
import { useToast } from "@/components/toast";

function imgSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve({ w: 1, h: 1 });
    im.src = dataUrl;
  });
}

export function PhotosToPdf({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (b: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const can = load.youRole === "dispatcher" || load.youRole === "admin";
  if (!can || load.photos.length === 0) return null;

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  const chosen = load.photos.filter((p) => sel.has(p.id));
  const list = chosen.length ? chosen : load.photos; // none selected = all

  async function build(download: boolean) {
    setBusy(true);
    try {
      const JsPDF = await loadJsPDF();
      const doc = new JsPDF({ unit: "pt", format: "a4" }) as JsPDFDoc;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 28;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (i > 0) doc.addPage();
        const { w, h } = await imgSize(p.dataUrl);
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const ratio = Math.min(maxW / w, maxH / h);
        const dw = w * ratio;
        const dh = h * ratio;
        const fmt = p.dataUrl.includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(p.dataUrl, fmt, (pageW - dw) / 2, (pageH - dh) / 2, dw, dh);
      }
      const name = `${load.ref}-photos.pdf`;
      if (download) doc.save(name);
      else {
        await mutate({ action: "document", docType: "attachment", name, dataUrl: doc.output("datauristring") });
        toast("Saved", "Photos combined into a PDF in documents.");
      }
    } catch {
      toast("PDF error", "Could not build the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3><FileImage /> Make a PDF from photos</h3>
      <p className="px">Tap photos to pick which go in the PDF. None selected = all.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {load.photos.map((p) => {
          const on = sel.has(p.id);
          return (
            <button key={p.id} onClick={() => toggle(p.id)}
              style={{
                position: "relative", padding: 0, borderRadius: 10, overflow: "hidden",
                border: `2px solid ${on ? "var(--sky, #38BDF8)" : "var(--line)"}`,
                outline: "none", cursor: "pointer", lineHeight: 0,
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt="" style={{ width: 84, height: 84, objectFit: "cover", opacity: on ? 1 : 0.7 }} />
              {on && (
                <span style={{
                  position: "absolute", top: 4, right: 4, background: "var(--sky, #38BDF8)",
                  color: "#0B1120", borderRadius: 999, width: 18, height: 18, fontSize: 12,
                  fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                }}>✓</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => build(true)} style={{ padding: "8px 14px" }}>
          <Download size={15} /> Create PDF ({list.length})
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => build(false)} style={{ padding: "8px 14px" }}>
          Save PDF to load
        </button>
      </div>
    </div>
  );
}
