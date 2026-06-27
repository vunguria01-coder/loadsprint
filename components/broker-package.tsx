"use client";

import { useState } from "react";
import { Package, Download } from "lucide-react";
import { loadJsPDF, type JsPDFDoc } from "@/components/use-jspdf";
import { loadJsZip } from "@/components/use-jszip";
import { useToast } from "@/components/toast";

type InvoiceLine = { label: string; amount: number };
type AiInvoice = {
  invoiceNumber: string;
  date: string;
  from?: string;
  billTo: string;
  lines: InvoiceLine[];
  subtotal: number;
  total: number;
  notes?: string;
};
type PackageData = {
  ok: boolean;
  ref: string;
  driverName: string;
  rate: number | null;
  confirmation: { name: string; dataUrl: string } | null;
  photos: { name: string; dataUrl: string }[];
  invoice: AiInvoice | null;
  error?: string;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function imgSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve({ w: 1, h: 1 });
    im.src = dataUrl;
  });
}

function extFromDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith("data:application/pdf")) return "pdf";
  if (dataUrl.includes("image/png")) return "png";
  if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) return "jpg";
  return "bin";
}
function base64Of(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

// Renders the AI invoice into a jsPDF document (returns a datauristring).
async function invoicePdf(inv: AiInvoice, ref: string): Promise<string> {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "pt", format: "a4" }) as JsPDFDoc;
  const W = doc.internal.pageSize.getWidth();
  const m = 48;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(17, 24, 39);
  doc.text("INVOICE", m, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(`#${inv.invoiceNumber}`, W - m, y - 8, { align: "right" });
  doc.text(`Date: ${inv.date}`, W - m, y + 8, { align: "right" });

  y += 36;
  if (inv.from) {
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.text(inv.from, m, y);
  }
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to:", W - m - 220, y, {});
  doc.setFont("helvetica", "normal");
  doc.text(inv.billTo || "—", W - m - 220, y + 16);

  y += 64;
  doc.setDrawColor(229, 231, 235);
  doc.line(m, y, W - m, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(10);
  doc.text("DESCRIPTION", m, y);
  doc.text("AMOUNT", W - m, y, { align: "right" });
  y += 8;
  doc.line(m, y, W - m, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(11);
  for (const ln of inv.lines || []) {
    doc.text(ln.label, m, y);
    doc.text(money(ln.amount), W - m, y, { align: "right" });
    y += 20;
  }
  y += 4;
  doc.line(m, y, W - m, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL", m, y);
  doc.text(money(inv.total), W - m, y, { align: "right" });

  if (inv.notes) {
    y += 36;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(inv.notes, m, y);
  }
  return doc.output("datauristring");
}

// Renders the photos into a single jsPDF document (returns a datauristring).
async function photosPdf(photos: { dataUrl: string }[]): Promise<string> {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "pt", format: "a4" }) as JsPDFDoc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  for (let i = 0; i < photos.length; i++) {
    if (i > 0) doc.addPage();
    const { w, h } = await imgSize(photos[i].dataUrl);
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = Math.min(maxW / w, maxH / h);
    const dw = w * ratio;
    const dh = h * ratio;
    const fmt = photos[i].dataUrl.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(photos[i].dataUrl, fmt, (pageW - dw) / 2, (pageH - dh) / 2, dw, dh);
  }
  return doc.output("datauristring");
}

export function BrokerPackage({
  loadId,
  loadRef,
  compact = false,
}: {
  loadId: string;
  loadRef: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function build() {
    setBusy(true);
    try {
      const res = await fetch(`/api/loads/${loadId}/package`);
      const data: PackageData = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not build package", data.error || "Try again.");
        setBusy(false);
        return;
      }

      const JsZip = await loadJsZip();
      const zip = new JsZip();

      // 1) Confirmation (rate con) — keep original format.
      if (data.confirmation) {
        const ext = extFromDataUrl(data.confirmation.dataUrl);
        zip.file(`confirmation.${ext}`, base64Of(data.confirmation.dataUrl), { base64: true });
      }

      // 2) Raw photos.
      data.photos.forEach((p) => {
        zip.file(p.name, base64Of(p.dataUrl), { base64: true });
      });

      // 3) Photos combined into a PDF (AI/code-built).
      if (data.photos.length > 0) {
        const pPdf = await photosPdf(data.photos);
        zip.file("photos.pdf", base64Of(pPdf), { base64: true });
      }

      // 4) Invoice PDF (AI-generated, price from the rate con).
      if (data.invoice) {
        const iPdf = await invoicePdf(data.invoice, data.ref);
        zip.file("invoice.pdf", base64Of(iPdf), { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.ref || loadRef}-broker-package.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Package ready", "Downloaded the broker package (ZIP).");
    } catch {
      toast("Package error", "Could not build the package.");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        className="pkg-btn"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          build();
        }}
      >
        <Download size={15} /> {busy ? "Preparing…" : "Download package"}
      </button>
    );
  }

  return (
    <div className="panel">
      <h3><Package /> Broker package</h3>
      <p className="px">One ZIP with the confirmation, photos, a photos PDF, and the AI invoice — ready to send to the broker.</p>
      <button className="btn btn-primary" disabled={busy} onClick={build} style={{ padding: "10px 16px", marginTop: 10 }}>
        <Download size={15} /> {busy ? "Preparing package…" : "Download broker package (ZIP)"}
      </button>
    </div>
  );
}
