"use client";

import { useState } from "react";
import { FileImage } from "lucide-react";
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

  const can = load.youRole === "dispatcher" || load.youRole === "admin";
  if (!can || load.photos.length === 0) return null;

  async function build(download: boolean) {
    setBusy(true);
    try {
      const JsPDF = await loadJsPDF();
      const doc = new JsPDF({ unit: "pt", format: "a4" }) as JsPDFDoc;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 28;
      for (let i = 0; i < load.photos.length; i++) {
        const p = load.photos[i];
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
      if (download) {
        doc.save(name);
      } else {
        const dataUrl = doc.output("datauristring");
        await mutate({ action: "document", docType: "attachment", name, dataUrl });
        toast("Saved", "Photos combined into a PDF in documents.");
      }
    } catch {
      toast("PDF error", "Could not build the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      <button className="btn btn-ghost" disabled={busy} onClick={() => build(true)} style={{ padding: "8px 14px" }}>
        <FileImage size={15} /> Photos → PDF (download)
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => build(false)} style={{ padding: "8px 14px" }}>
        Save photos as PDF to load
      </button>
    </div>
  );
}
