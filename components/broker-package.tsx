"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Download, X, Check, FileText, Image as ImageIcon, Receipt, Pencil } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [data, setData] = useState<PackageData | null>(null);

  // Open the review modal and load what's inside the package.
  async function openReview(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(true);
    if (data) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch(`/api/loads/${loadId}/package`);
      const d: PackageData = await res.json();
      if (!res.ok || !d.ok) {
        toast("Could not load package", d.error || "Try again.");
        setOpen(false);
      } else {
        setData(d);
      }
    } catch {
      toast("Package error", "Could not load the package.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
  }

  // Build the ZIP from the already-loaded data and download it.
  async function download() {
    if (!data) return;
    setBuilding(true);
    try {
      const JsZip = await loadJsZip();
      const zip = new JsZip();

      if (data.confirmation) {
        const ext = extFromDataUrl(data.confirmation.dataUrl);
        zip.file(`confirmation.${ext}`, base64Of(data.confirmation.dataUrl), { base64: true });
      }
      data.photos.forEach((p) => {
        zip.file(p.name, base64Of(p.dataUrl), { base64: true });
      });
      if (data.photos.length > 0) {
        const pPdf = await photosPdf(data.photos);
        zip.file("photos.pdf", base64Of(pPdf), { base64: true });
      }
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
      setBuilding(false);
    }
  }

  const conf = data?.confirmation || null;
  const photos = data?.photos || [];
  const invoice = data?.invoice || null;

  const modal = open && (
    <>
      <div className="pkg-scrim" onClick={close} />
      <div className="pkg-modal" role="dialog" aria-label="Broker package">
        <div className="pkg-modal-head">
          <div>
            <div className="pkg-eyebrow">Broker package</div>
            <div className="pkg-modal-title">{data?.ref || loadRef}</div>
          </div>
          <button className="pkg-x" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="px" style={{ padding: "8px 0 14px" }}>Loading what&apos;s inside…</p>
        ) : data ? (
          <>
            <p className="pkg-sub">Check everything below. Open the load to fix anything, then download.</p>

            <div className="pkg-items">
              <div className={`pkg-item${conf ? " ok" : " no"}`}>
                <span className="pkg-ic"><FileText size={16} /></span>
                <div className="pkg-it-body">
                  <b>Rate confirmation</b>
                  <span>{conf ? conf.name : "Not attached — open the load to add it"}</span>
                </div>
                <span className="pkg-flag">{conf ? <Check size={16} /> : "Missing"}</span>
              </div>

              <div className={`pkg-item${photos.length ? " ok" : " no"}`}>
                <span className="pkg-ic"><ImageIcon size={16} /></span>
                <div className="pkg-it-body">
                  <b>{photos.length} photo{photos.length === 1 ? "" : "s"}</b>
                  <span>{photos.length ? "Included in the ZIP and a photos PDF" : "No photos yet"}</span>
                  {photos.length > 0 && (
                    <div className="pkg-thumbs">
                      {photos.slice(0, 6).map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={p.dataUrl} alt={`Photo ${i + 1}`} />
                      ))}
                      {photos.length > 6 && <span className="pkg-more">+{photos.length - 6}</span>}
                    </div>
                  )}
                </div>
                <span className="pkg-flag">{photos.length ? <Check size={16} /> : "—"}</span>
              </div>

              <div className={`pkg-item${invoice ? " ok" : " no"}`}>
                <span className="pkg-ic"><Receipt size={16} /></span>
                <div className="pkg-it-body">
                  <b>Invoice</b>
                  <span>
                    {invoice
                      ? `#${invoice.invoiceNumber} · total ${money(invoice.total)}`
                      : "Not generated yet — open the load to create it"}
                  </span>
                </div>
                <span className="pkg-flag">{invoice ? <Check size={16} /> : "Missing"}</span>
              </div>
            </div>

            <div className="pkg-actions">
              <Link href={`/loads/${loadId}`} className="btn btn-ghost">
                <Pencil size={15} /> Open load to edit
              </Link>
              <button type="button" className="btn btn-primary" onClick={download} disabled={building}>
                <Download size={15} /> {building ? "Preparing…" : "Download package"}
              </button>
            </div>
          </>
        ) : (
          <p className="px">Could not load the package.</p>
        )}
      </div>
    </>
  );

  if (compact) {
    return (
      <>
        <button type="button" className="pkg-btn" disabled={loading && open} onClick={openReview}>
          <Package size={15} /> Review &amp; send
        </button>
        {modal}
      </>
    );
  }

  return (
    <div className="panel">
      <h3><Package /> Broker package</h3>
      <p className="px">Check the confirmation, photos and invoice, then download one ZIP ready to send to the broker.</p>
      <button className="btn btn-primary" onClick={openReview} style={{ padding: "10px 16px", marginTop: 10 }}>
        <Package size={15} /> Review &amp; send package
      </button>
      {modal}
    </div>
  );
}
