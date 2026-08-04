"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { useToast } from "@/components/toast";
import { invoiceTotals, usDate, type InvoiceDoc } from "@/lib/invoice-build";
import type { LoadView } from "@/lib/load-view";

const money = (n: number) =>
  "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LoadInvoice({ load }: { load: LoadView }) {
  const toast = useToast();
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function loadDraft(showToast = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/loads/${load.id}/invoice`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setInv(data.invoice);
        setPdfUrl(null);
        if (showToast) toast("Draft rebuilt", "Re-read the load's stops and rate.");
      } else {
        toast("Could not prepare the invoice", data.error || "Try again.");
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id]);

  function set<K extends keyof InvoiceDoc>(k: K, v: InvoiceDoc[K]) {
    setInv((p) => (p ? { ...p, [k]: v } : p));
    setPdfUrl(null);
  }

  function setItem(i: number, patch: Partial<InvoiceDoc["items"][number]>) {
    setInv((p) =>
      p ? { ...p, items: p.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : p
    );
    setPdfUrl(null);
  }

  async function create() {
    if (!inv) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/loads/${load.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: inv }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not create the invoice", data.error || "Try again.");
        return;
      }
      setInv(data.invoice);
      setPdfUrl(data.dataUrl);
      toast(
        `Invoice ${data.invoice.invoiceNumber} created`,
        "Saved to this load — it goes to the broker with the final documents."
      );
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openPdf() {
    if (!pdfUrl) return;
    // A data: URL can't be navigated to directly in some browsers — hand the
    // bytes to a blob URL instead so "open" always works.
    const [meta, b64] = pdfUrl.split(",");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: meta.includes("pdf") ? "application/pdf" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (loading && !inv) {
    return (
      <div className="panel inv-panel">
        <h3><FileText /> Invoice</h3>
        <p className="px">Preparing the invoice…</p>
      </div>
    );
  }
  if (!inv) {
    return (
      <div className="panel inv-panel">
        <h3><FileText /> Invoice</h3>
        <p className="px">Could not prepare the invoice.</p>
        <button className="btn btn-ghost" onClick={() => loadDraft(true)}>Retry</button>
      </div>
    );
  }

  const t = invoiceTotals(inv);

  return (
    <div className="panel inv-panel">
      <h3><FileText /> Invoice</h3>
      {load.status !== "Closed" && (
        <p className="px">
          This load is still {load.status.toLowerCase()} — you can still invoice it now.
        </p>
      )}
      {!inv.company.name && (
        <p className="px invx-warn">
          Your company details are empty. Fill them in under <a href="/invoice-settings">Invoice settings</a> so
          they appear at the top of the invoice.
        </p>
      )}

      <div className="fgrid invx-grid">
        <div className="field">
          <label>Invoice No</label>
          <input value={inv.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={inv.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="field">
          <label>Terms</label>
          <input value={inv.terms} onChange={(e) => set("terms", e.target.value)} placeholder="NET 30" />
        </div>
        <div className="field">
          <label>Due date</label>
          <input type="date" value={inv.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
        <div className="field full">
          <label>Bill to (payer)</label>
          <textarea
            rows={3}
            value={inv.billTo}
            onChange={(e) => set("billTo", e.target.value)}
            placeholder="Broker name and address from the rate confirmation"
          />
        </div>
        <div className="field full">
          <label>Ship to (optional)</label>
          <textarea rows={2} value={inv.shipTo} onChange={(e) => set("shipTo", e.target.value)} />
        </div>
        <div className="field">
          <label>Tracking No</label>
          <input value={inv.trackingNo} onChange={(e) => set("trackingNo", e.target.value)} />
        </div>
        <div className="field">
          <label>Ship via</label>
          <input value={inv.shipVia} onChange={(e) => set("shipVia", e.target.value)} />
        </div>
        <div className="field">
          <label>FOB</label>
          <input value={inv.fob} onChange={(e) => set("fob", e.target.value)} />
        </div>
      </div>

      <div className="inv-group-label">Line items</div>
      {inv.items.map((item, i) => (
        <div className="fgrid invx-grid" key={i}>
          <div className="field full">
            <label>Description — one stop per line</label>
            <textarea
              rows={Math.min(8, Math.max(3, item.description.split("\n").length))}
              value={item.description}
              onChange={(e) => setItem(i, { description: e.target.value })}
              placeholder={"Pickup 05/27/2026 Portland Or, 97211\nDelivery 05/28/2026 Spokane WA, 99217"}
            />
          </div>
          <div className="field">
            <label>Quantity</label>
            <input
              type="number"
              min={0}
              value={item.quantity}
              onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Rate</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={item.rate}
              onChange={(e) => setItem(i, { rate: Number(e.target.value) })}
            />
          </div>
        </div>
      ))}

      <div className="inv-group-label">Totals</div>
      <div className="fgrid invx-grid">
        <div className="field">
          <label>TAX %</label>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={inv.taxPercent}
            onChange={(e) => set("taxPercent", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Shipping</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={inv.shipping}
            onChange={(e) => set("shipping", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Paid</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={inv.paid}
            onChange={(e) => set("paid", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="inv-calc invx-calc">
        <div><span>Subtotal</span><b>{money(t.subtotal)}</b></div>
        <div><span>TAX {inv.taxPercent}%</span><b>{money(t.tax)}</b></div>
        <div><span>Shipping</span><b>{money(inv.shipping)}</b></div>
        <div><span>Total</span><b>{money(t.total)}</b></div>
        <div><span>Paid</span><b>{money(inv.paid)}</b></div>
        <div className="inv-total"><span>Balance Due</span><b>{money(t.balanceDue)}</b></div>
      </div>

      <p className="px invx-due">Due {usDate(inv.dueDate)} · {inv.terms || "no terms set"}</p>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={create} disabled={saving}>
          {saving ? "Creating…" : pdfUrl ? "Recreate invoice" : "Create invoice"}
        </button>
        {pdfUrl && (
          <>
            <button className="btn btn-ghost" onClick={openPdf}>Open PDF</button>
            <a className="btn btn-ghost" href={pdfUrl} download={`Invoice ${inv.invoiceNumber}.pdf`}>
              Download
            </a>
          </>
        )}
        <button className="btn btn-ghost" onClick={() => loadDraft(true)} disabled={loading}>
          <RefreshCw size={15} /> Reset from load
        </button>
      </div>
      {pdfUrl && (
        <p className="px invx-saved">
          ✓ Saved to this load as “Invoice {inv.invoiceNumber}.pdf” — it is sent to the broker with the
          final documents.
        </p>
      )}
    </div>
  );
}
