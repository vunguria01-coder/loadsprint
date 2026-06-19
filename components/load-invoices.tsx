"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Send } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import type { InvoiceCell } from "@/lib/loads";
import type { InvoiceProfile } from "@/lib/schemas";
import { loadJsPDF, type JsPDFDoc } from "@/components/use-jspdf";
import { useToast } from "@/components/toast";

type Kind = "broker" | "driver";

async function buildInvoicePdf(
  kind: Kind,
  load: LoadView,
  profile: InvoiceProfile,
  cell: { number: string; amount: number; currency: string; notes: string }
): Promise<JsPDFDoc> {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "pt", format: "a4" }) as JsPDFDoc;
  const left = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(profile.companyName || "Invoice", left, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  y += 18;
  [profile.address, profile.phone, profile.email].filter(Boolean).forEach((line) => {
    doc.text(String(line), left, y);
    y += 14;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text("INVOICE", 420, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  doc.text(`Invoice #: ${cell.number}`, 420, 80);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 420, 94);
  doc.text(`Load: ${load.ref}`, 420, 108);

  y = Math.max(y, 140);
  doc.setDrawColor(220, 225, 235);
  doc.line(left, y, 548, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Bill to", left, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 70, 90);
  y += 16;
  if (kind === "broker") {
    doc.text(load.brokerName || "Broker", left, y); y += 14;
    if (load.brokerEmail) { doc.text(load.brokerEmail, left, y); y += 14; }
    if (load.brokerPhone) { doc.text(load.brokerPhone, left, y); y += 14; }
  } else {
    doc.text(load.driverName || "Driver", left, y); y += 14;
    if (load.driverEmail) { doc.text(load.driverEmail, left, y); y += 14; }
  }

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Route: ${load.originName}  →  ${load.destName}`, left, y);
  y += 26;

  doc.setFillColor(241, 245, 249);
  doc.rect(left, y, 500, 30, "F");
  doc.setTextColor(15, 23, 42);
  doc.text("Description", left + 10, y + 20);
  doc.text("Amount", 470, y + 20);
  y += 44;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 70, 90);
  doc.text(kind === "broker" ? "Transportation services" : "Driver pay", left + 10, y);
  doc.text(`${cell.currency}${cell.amount.toFixed(2)}`, 470, y);
  y += 24;
  doc.setDrawColor(220, 225, 235);
  doc.line(left, y, 548, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Total", left + 10, y);
  doc.text(`${cell.currency}${cell.amount.toFixed(2)}`, 470, y);

  y += 36;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  if (profile.payTerms) { doc.text(`Terms: ${profile.payTerms}`, left, y); y += 14; }
  if (cell.notes) { doc.text(cell.notes, left, y); y += 14; }
  if (profile.notes) { doc.text(profile.notes, left, y); y += 14; }

  return doc;
}

function Cell({
  kind,
  load,
  profile,
  mutate,
}: {
  kind: Kind;
  load: LoadView;
  profile: InvoiceProfile;
  mutate: (b: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const cell: InvoiceCell | undefined = kind === "broker" ? load.brokerInvoice : load.driverInvoice;
  const [amount, setAmount] = useState<string>(cell ? String(cell.amount) : "");
  const [notes, setNotes] = useState<string>(cell?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const number = cell?.number ?? `${load.ref}-${kind === "broker" ? "B" : "D"}`;
  const currency = cell?.currency ?? "$";

  async function save() {
    const a = Number(amount);
    if (!Number.isFinite(a) || a < 0) { toast("Invalid amount", "Enter a number."); return; }
    setBusy(true);
    try {
      await mutate({ action: "invoice_set", kind, amount: a, notes });
      toast("Saved", `${kind === "broker" ? "Broker" : "Driver"} invoice saved.`);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const a = Number(amount) || cell?.amount || 0;
    try {
      const doc = await buildInvoicePdf(kind, load, profile, { number, amount: a, currency, notes });
      doc.save(`${number}.pdf`);
    } catch {
      toast("PDF error", "Could not generate the PDF.");
    }
  }

  async function send() {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) { toast("Set an amount", "Enter the invoice amount first."); return; }
    setBusy(true);
    try {
      await mutate({ action: "invoice_set", kind, amount: a, notes });
      const doc = await buildInvoicePdf(kind, load, profile, { number, amount: a, currency, notes });
      const dataUrl = doc.output("datauristring");
      await mutate({ action: "document", docType: `invoice_${kind}`, name: `${number}.pdf`, dataUrl });
      await mutate({ action: "invoice_sent", kind });
      toast("Invoice sent", kind === "broker" ? "Sent to broker." : "Sent to driver.");
    } catch {
      toast("Send failed", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{kind === "broker" ? "Broker invoice" : "Driver invoice"}</strong>
        {cell && (
          <span className="status-chip" style={{ textTransform: "uppercase" }}>
            {cell.status}
          </span>
        )}
      </div>
      <div className="fgrid" style={{ marginTop: 10 }}>
        <div className="field">
          <label>Amount ({currency})</label>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. detention" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={save} disabled={busy} style={{ padding: "8px 14px" }}>
          Save
        </button>
        <button className="btn btn-ghost" onClick={download} disabled={busy} style={{ padding: "8px 14px" }}>
          <Download size={15} /> PDF
        </button>
        <button className="btn btn-primary" onClick={send} disabled={busy} style={{ padding: "8px 14px" }}>
          <Send size={15} /> Send
        </button>
      </div>
      {cell && cell.history.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="px" style={{ cursor: "pointer" }}>History ({cell.history.length})</summary>
          <div style={{ marginTop: 6 }}>
            {cell.history.slice().reverse().map((h) => (
              <div key={h.id} className="px" style={{ padding: "4px 0" }}>
                {new Date(h.at).toLocaleString()} — {h.action} {currency}{h.amount} · {h.byName}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
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
      } catch {
        /* ignore */
      }
    })();
  }, [isDispatcher]);

  if (!isDispatcher) return null;

  return (
    <div className="panel">
      <h3>
        <FileText /> Invoices
      </h3>
      {!profile?.companyName && (
        <p className="px">
          Tip: set your company details in <a className="link" href="/invoice-settings">Invoice details</a> so they
          appear on the PDF.
        </p>
      )}
      <Cell kind="broker" load={load} profile={profile ?? ({} as InvoiceProfile)} mutate={mutate} />
      <Cell kind="driver" load={load} profile={profile ?? ({} as InvoiceProfile)} mutate={mutate} />
    </div>
  );
}
