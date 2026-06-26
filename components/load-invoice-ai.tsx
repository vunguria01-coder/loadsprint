"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useToast } from "@/components/toast";
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

export function LoadInvoiceAi({ load }: { load: LoadView }) {
  const toast = useToast();
  const [inv, setInv] = useState<AiInvoice | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/loads/${load.id}/invoice`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) setInv(data.invoice);
      else toast("Could not build invoice", data.error || "Try again.");
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
            rate and stops — then review and print it.
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
              onChange={(e) => setInv({ ...inv, billTo: e.target.value })}
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
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={printInvoice}>Print / Save PDF</button>
            <button className="btn btn-ghost" onClick={generate} disabled={busy}>
              {busy ? "…" : "Regenerate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
