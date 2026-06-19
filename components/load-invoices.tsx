"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Send, Plus } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import type { InvoiceCell } from "@/lib/loads";
import type { InvoiceProfile } from "@/lib/schemas";
import { loadJsPDF, type JsPDFDoc } from "@/components/use-jspdf";
import { useToast } from "@/components/toast";

type Kind = "broker" | "driver";

type Line = { label: string; value: string; bold?: boolean; accent?: boolean };

async function buildInvoicePdf(opts: {
  kind: Kind;
  load: LoadView;
  profile: InvoiceProfile;
  number: string;
  currency: string;
  billToName: string;
  billToContact: string[];
  lines: Line[];
  totalLabel: string;
  totalValue: string;
  notes: string;
}): Promise<JsPDFDoc> {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "pt", format: "a4" }) as JsPDFDoc;
  const pageW = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageW - 48;

  // Accent header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 92, "F");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 92, pageW, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.profile.companyName || "Invoice", left, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(190, 200, 215);
  let hy = 60;
  [opts.profile.address, [opts.profile.phone, opts.profile.email].filter(Boolean).join("  ·  ")]
    .filter(Boolean)
    .forEach((line) => {
      doc.text(String(line), left, hy);
      hy += 13;
    });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("INVOICE", right, 44, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(190, 200, 215);
  doc.text(`#${opts.number}`, right, 62, { align: "right" });
  doc.text(new Date().toLocaleDateString(), right, 76, { align: "right" });

  // Bill to
  let y = 132;
  doc.setTextColor(120, 130, 150);
  doc.setFontSize(9);
  doc.text("BILL TO", left, y);
  doc.text("LOAD", right, y, { align: "right" });
  y += 16;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(opts.billToName || "—", left, y);
  doc.text(opts.load.ref, right, y, { align: "right" });
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(80, 90, 110);
  opts.billToContact.filter(Boolean).forEach((c) => {
    doc.text(c, left, y);
    y += 13;
  });
  doc.text(`${opts.load.originName}  →  ${opts.load.destName}`, right, y - opts.billToContact.length * 13 + 13, { align: "right" });

  // Lines table
  y = Math.max(y, 210) + 10;
  doc.setFillColor(241, 245, 249);
  doc.rect(left, y, right - left, 26, "F");
  doc.setTextColor(80, 90, 110);
  doc.setFontSize(9);
  doc.text("DESCRIPTION", left + 10, y + 17);
  doc.text("AMOUNT", right - 10, y + 17, { align: "right" });
  y += 38;

  doc.setFontSize(10.5);
  opts.lines.forEach((ln) => {
    doc.setFont("helvetica", ln.bold ? "bold" : "normal");
    doc.setTextColor(ln.accent ? 37 : 40, ln.accent ? 99 : 50, ln.accent ? 235 : 70);
    doc.text(ln.label, left + 10, y);
    doc.text(ln.value, right - 10, y, { align: "right" });
    y += 20;
  });

  y += 6;
  doc.setDrawColor(220, 225, 235);
  doc.line(left, y, right, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(opts.totalLabel, left + 10, y);
  doc.setTextColor(37, 99, 235);
  doc.text(opts.totalValue, right - 10, y, { align: "right" });

  // Footer
  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(110, 120, 140);
  if (opts.profile.payTerms) { doc.text(`Terms: ${opts.profile.payTerms}`, left, y); y += 14; }
  if (opts.notes) { doc.text(opts.notes, left, y); y += 14; }
  if (opts.profile.notes) { doc.text(opts.profile.notes, left, y); y += 14; }

  return doc;
}

function money(n: number, cur: string) {
  return `${cur}${(Math.round(n * 100) / 100).toFixed(2)}`;
}

/* ---------- Broker cell ---------- */
function BrokerCell({
  load,
  profile,
  mutate,
}: {
  load: LoadView;
  profile: InvoiceProfile;
  mutate: (b: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const cell: InvoiceCell | undefined = load.brokerInvoice;
  const [amount, setAmount] = useState<string>(
    cell ? String(cell.amount) : load.loadRate ? String(load.loadRate) : ""
  );
  const [notes, setNotes] = useState(cell?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const currency = cell?.currency ?? "$";
  const number = cell?.number ?? `${load.ref}-B`;

  async function persist() {
    const a = Number(amount);
    if (!Number.isFinite(a) || a < 0) { toast("Invalid amount", "Enter a number."); return false; }
    await mutate({ action: "invoice_set", kind: "broker", amount: a, notes });
    return true;
  }
  async function pdf() {
    const a = Number(amount) || 0;
    return buildInvoicePdf({
      kind: "broker", load, profile, number, currency,
      billToName: load.brokerName || "Broker",
      billToContact: [load.brokerEmail, load.brokerPhone],
      lines: [{ label: `Transportation: ${load.originName} → ${load.destName}`, value: money(a, currency) }],
      totalLabel: "Total due", totalValue: money(a, currency), notes,
    });
  }
  async function create() {
    setBusy(true);
    try { if (await persist()) { (await pdf()).save(`${number}.pdf`); toast("Invoice created", "Broker PDF downloaded."); } }
    catch { toast("PDF error", "Try again."); }
    finally { setBusy(false); }
  }
  async function send() {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) { toast("Set an amount", "Enter the amount first."); return; }
    setBusy(true);
    try {
      if (!(await persist())) return;
      const doc = await pdf();
      await mutate({ action: "document", docType: "invoice_broker", name: `${number}.pdf`, dataUrl: doc.output("datauristring") });
      await mutate({ action: "invoice_sent", kind: "broker" });
      toast("Sent to broker", load.hasBroker ? "Broker notified." : "Saved (external broker — send the PDF by email).");
    } catch { toast("Send failed", "Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="inv-cell">
      <div className="inv-head">
        <strong>Broker invoice</strong>
        {cell && <span className="status-chip">{cell.status}</span>}
      </div>
      {!!load.loadRate && !cell && (
        <p className="px">Auto-filled from the rate confirmation: {money(load.loadRate, currency)} (editable).</p>
      )}
      <div className="fgrid" style={{ marginTop: 8 }}>
        <div className="field">
          <label>Amount billed to broker ({currency})</label>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. detention" />
        </div>
      </div>
      <Actions busy={busy} onCreate={create} onSend={send} />
      <History cell={cell} currency={currency} />
    </div>
  );
}

/* ---------- Driver cell ---------- */
function DriverCell({
  load,
  profile,
  mutate,
}: {
  load: LoadView;
  profile: InvoiceProfile;
  mutate: (b: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const cell: InvoiceCell | undefined = load.driverInvoice;
  const [gross, setGross] = useState<string>(
    cell?.gross != null ? String(cell.gross) : load.loadRate ? String(load.loadRate) : ""
  );
  const [cType, setCType] = useState<"pct" | "amt">(cell?.commissionType ?? "pct");
  const [cVal, setCVal] = useState<string>(cell?.commissionValue != null ? String(cell.commissionValue) : "10");
  const [notes, setNotes] = useState(cell?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const currency = cell?.currency ?? "$";
  const number = cell?.number ?? `${load.ref}-D`;

  const g = Number(gross) || 0;
  const v = Number(cVal) || 0;
  const commission = cType === "pct" ? (g * v) / 100 : v;
  const payout = Math.max(0, g - commission);

  async function persist() {
    if (!(g > 0)) { toast("Enter load price", "Set the full load price."); return false; }
    await mutate({
      action: "invoice_set", kind: "driver", amount: payout, notes,
      gross: g, commissionType: cType, commissionValue: v,
    });
    return true;
  }
  async function pdf() {
    return buildInvoicePdf({
      kind: "driver", load, profile, number, currency,
      billToName: load.driverName || "Driver",
      billToContact: [load.driverEmail],
      lines: [
        { label: `Load price: ${load.originName} → ${load.destName}`, value: money(g, currency) },
        { label: `Dispatcher commission ${cType === "pct" ? `(${v}%)` : ""}`, value: `- ${money(commission, currency)}` },
      ],
      totalLabel: "Driver payout", totalValue: money(payout, currency), notes,
    });
  }
  async function create() {
    setBusy(true);
    try { if (await persist()) { (await pdf()).save(`${number}.pdf`); toast("Invoice created", "Driver PDF downloaded."); } }
    catch { toast("PDF error", "Try again."); }
    finally { setBusy(false); }
  }
  async function send() {
    setBusy(true);
    try {
      if (!(await persist())) return;
      const doc = await pdf();
      await mutate({ action: "document", docType: "invoice_driver", name: `${number}.pdf`, dataUrl: doc.output("datauristring") });
      await mutate({ action: "invoice_sent", kind: "driver" });
      toast("Sent to driver", "Driver notified.");
    } catch { toast("Send failed", "Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="inv-cell">
      <div className="inv-head">
        <strong>Driver invoice</strong>
        {cell && <span className="status-chip">{cell.status}</span>}
      </div>
      <div className="fgrid" style={{ marginTop: 8 }}>
        <div className="field">
          <label>Full load price ({currency})</label>
          <input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} placeholder="2000" />
        </div>
        <div className="field">
          <label>Dispatcher commission</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" min={0} value={cVal} onChange={(e) => setCVal(e.target.value)} placeholder="10" style={{ flex: 1 }} />
            <select value={cType} onChange={(e) => setCType(e.target.value as "pct" | "amt")} style={{ width: 70 }}>
              <option value="pct">%</option>
              <option value="amt">{currency}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="inv-calc">
        <div><span>Load price</span><b>{money(g, currency)}</b></div>
        <div><span>Dispatcher keeps</span><b>- {money(commission, currency)}</b></div>
        <div className="inv-total"><span>Driver gets</span><b>{money(payout, currency)}</b></div>
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <label>Note (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. fuel advance deducted" />
      </div>
      <Actions busy={busy} onCreate={create} onSend={send} />
      <History cell={cell} currency={currency} />
    </div>
  );
}

function Actions({ busy, onCreate, onSend }: { busy: boolean; onCreate: () => void; onSend: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      <button className="btn btn-primary" onClick={onCreate} disabled={busy} style={{ padding: "8px 14px" }}>
        <Plus size={15} /> Create invoice (PDF)
      </button>
      <button className="btn btn-ghost" onClick={onSend} disabled={busy} style={{ padding: "8px 14px" }}>
        <Send size={15} /> Send
      </button>
    </div>
  );
}

function History({ cell, currency }: { cell?: InvoiceCell; currency: string }) {
  if (!cell || cell.history.length === 0) return null;
  return (
    <details style={{ marginTop: 10 }}>
      <summary className="px" style={{ cursor: "pointer" }}>History ({cell.history.length})</summary>
      <div style={{ marginTop: 6 }}>
        {cell.history.slice().reverse().map((h) => (
          <div key={h.id} className="px" style={{ padding: "3px 0" }}>
            {new Date(h.at).toLocaleString()} — {h.action} {money(h.amount, currency)} · {h.byName}
          </div>
        ))}
      </div>
    </details>
  );
}

export function LoadInvoices({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [profile, setProfile] = useState<InvoiceProfile | null>(null);
  const isDispatcher = load.youRole === "dispatcher" || load.youRole === "admin";

  useEffect(() => {
    if (!isDispatcher) return;
    (async () => {
      try {
        const res = await fetch("/api/invoice-profile");
        const data = await res.json();
        if (data.ok) setProfile(data.profile);
      } catch { /* ignore */ }
    })();
  }, [isDispatcher]);

  if (!isDispatcher) return null;
  const p = profile ?? ({} as InvoiceProfile);

  return (
    <div className="panel">
      <h3><FileText /> Invoices</h3>
      {!profile?.companyName && (
        <p className="px">
          Tip: set your company details in <a className="link" href="/invoice-settings">Invoice details</a> so they appear on the PDF.
        </p>
      )}
      <BrokerCell load={load} profile={p} mutate={mutate} />
      <DriverCell load={load} profile={p} mutate={mutate} />
    </div>
  );
}
