"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useToast } from "@/components/toast";
import { loadJsPDF } from "@/components/use-jspdf";
import type { LoadView } from "@/lib/load-view";

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

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function LoadInvoiceAi({
  load,
  mutate,
}: {
  load: LoadView;
  mutate?: (body: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const [inv, setInv] = useState<AiInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Build a clean PDF of the invoice on the client (jsPDF from CDN).
  async function buildInvoicePdf(data: AiInvoice): Promise<string> {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 48;
    const AMOUNT_W = 110; // reserved width for the right-hand amount column
    const DESC_W = W - 2 * M - AMOUNT_W; // wrap descriptions within this width

    // Header band.
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, W, 96, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("INVOICE", M, 50);

    // Carrier ("from") block, top-right inside the band.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(203, 213, 225); // slate-300
    let ry = 32;
    (data.from || "LoadSprint")
      .split("\n")
      .slice(0, 5)
      .forEach((ln) => {
        doc.text(ln, W - M, ry, { align: "right" });
        ry += 12.5;
      });

    // Route / reference summary just under the band (NOT inside line labels).
    const route = `Load ${load.ref} — ${load.originName} to ${load.destName}`;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    const routeLine = doc.splitTextToSize(route, W - 2 * M)[0];
    doc.text(routeLine, M, 80);

    let y = 132;
    // Invoice meta (left) + Bill to (right column).
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text("INVOICE #", M, y);
    doc.text("DATE", M, y + 28);
    doc.text("BILL TO", W / 2, y);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(data.invoiceNumber), M, y + 14);
    doc.text(String(data.date), M, y + 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const billLines = doc.splitTextToSize(data.billTo || "—", W / 2 - M);
    doc.text(billLines.slice(0, 4), W / 2, y + 14);

    y += 70;

    // Table header.
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.line(M, y, W - M, y);
    y += 16;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text("DESCRIPTION", M, y);
    doc.text("AMOUNT", W - M, y, { align: "right" });
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 20;

    // Line items — descriptions wrap, amount stays on the first line, right-aligned.
    doc.setFontSize(11);
    data.lines.forEach((l) => {
      if (y > H - 120) {
        doc.addPage();
        y = M + 20;
      }
      const wrapped = doc.splitTextToSize(String(l.label), DESC_W);
      doc.setTextColor(17, 24, 39);
      doc.text(wrapped, M, y);
      doc.text(money(l.amount), W - M, y, { align: "right" });
      y += 14 * Math.max(1, wrapped.length) + 6;
      doc.setDrawColor(241, 245, 249);
      doc.line(M, y - 8, W - M, y - 8);
    });

    // Total.
    y += 8;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.line(W / 2, y - 6, W - M, y - 6);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text("Total", W / 2, y);
    doc.text(money(data.total), W - M, y, { align: "right" });

    // Notes / payment terms.
    if (data.notes) {
      y += 34;
      if (y > H - 80) {
        doc.addPage();
        y = M + 20;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const notes = doc.splitTextToSize(String(data.notes), W - 2 * M);
      doc.text(notes.slice(0, 6), M, y);
    }

    return doc.output("datauristring");
  }

  // Persist the invoice as a load document so it is sent to the broker on "Send".
  async function saveToLoad(data: AiInvoice) {
    if (!mutate) return;
    setSaving(true);
    try {
      const dataUrl = await buildInvoicePdf(data);
      const name = `Invoice ${data.invoiceNumber}.pdf`;
      await mutate({ action: "save_invoice", name, dataUrl });
      setSaved(true);
    } catch {
      setSaved(false);
      toast(
        "Saved to view only",
        "Couldn't attach the invoice to the load. Tap “Save to load” to retry."
      );
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/loads/${load.id}/invoice`, {
        method: "POST",
        // Don't let the "generating…" state hang forever if the AI call stalls.
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setInv(data.invoice);
        // Auto-save so the dispatcher never has to remember a separate step.
        await saveToLoad(data.invoice);
      } else {
        toast("Could not build invoice", data.error || "Try again.");
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function printInvoice() {
    if (!inv) return;
    const rows = inv.lines
      .map(
        (l) =>
          `<tr><td>${l.label}</td><td style="text-align:right">${money(l.amount)}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoiceNumber}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:720px;margin:40px auto;padding:0 24px}
        h1{font-size:26px;margin:0 0 4px} .muted{color:#666;font-size:13px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        td,th{padding:10px 8px;border-bottom:1px solid #ddd;font-size:14px}
        th{text-align:left;color:#666;font-size:12px;text-transform:uppercase}
        .total{font-size:18px;font-weight:700}
        .notes{margin-top:18px;color:#444;font-size:13px}
      </style></head><body>
      <div class="head">
        <div><h1>INVOICE</h1><div class="muted">${inv.invoiceNumber}</div><div class="muted">Date: ${inv.date}</div></div>
        <div style="text-align:right;white-space:pre-line">${
          inv.from ? inv.from : "LoadSprint"
        }<div class="muted">Load ${load.ref}</div></div>
      </div>
      <div class="muted"><b>Bill to:</b> ${inv.billTo || "—"}</div>
      <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}
      <tr><td style="text-align:right;border-top:2px solid #111" class="total">Total</td><td style="text-align:right;border-top:2px solid #111" class="total">${money(inv.total)}</td></tr>
      </tbody></table>
      ${inv.notes ? `<div class="notes"><b>Notes:</b> ${inv.notes}</div>` : ""}
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
  }

  return (
    <div className="panel inv-panel">
      <h3>
        <FileText /> Invoice
      </h3>
      {!inv ? (
        <>
          <p className="px">
            This load is closed. Let AI build the carrier invoice from the load
            rate and stops — it is saved to the load and sent to the broker when
            you release the final documents.
          </p>
          <button className="btn btn-primary btn-block" onClick={generate} disabled={busy}>
            {busy ? "Building invoice…" : "✦ Generate invoice with AI"}
          </button>
        </>
      ) : (
        <div className="inv-view">
          <div className="inv-meta">
            <div><span>Invoice</span><b>{inv.invoiceNumber}</b></div>
            <div><span>Date</span><b>{inv.date}</b></div>
          </div>
          {inv.from && (
            <div className="inv-from">
              <span>From</span>
              <div>{inv.from}</div>
            </div>
          )}
          <label className="inv-billedit">
            <span>Bill to (payer)</span>
            <input
              type="text"
              value={inv.billTo}
              placeholder="Taken from the rate con — edit if needed"
              onChange={(e) => {
                setInv({ ...inv, billTo: e.target.value });
                setSaved(false);
              }}
            />
          </label>
          <div className="inv-lines">
            {inv.lines.map((l, i) => (
              <div key={i} className="inv-line">
                <span>{l.label}</span>
                <b>{money(l.amount)}</b>
              </div>
            ))}
            <div className="inv-line inv-grand">
              <span>Total</span>
              <b>{money(inv.total)}</b>
            </div>
          </div>
          {inv.notes && <p className="inv-notes">{inv.notes}</p>}

          {mutate && (
            <p
              className="px"
              style={{
                marginTop: 12,
                fontSize: 13,
                color: saved ? "var(--ok, #15803d)" : "var(--muted)",
              }}
            >
              {saving
                ? "Saving invoice to the load…"
                : saved
                ? "✓ Saved to this load — it will be sent to the broker with the final documents."
                : "Not saved yet — tap “Save to load” so it reaches the broker."}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={printInvoice}>Print / Save PDF</button>
            {mutate && !saved && (
              <button
                className="btn btn-ghost"
                onClick={() => saveToLoad(inv)}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save to load"}
              </button>
            )}
            <button className="btn btn-ghost" onClick={generate} disabled={busy}>
              {busy ? "…" : "Regenerate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
