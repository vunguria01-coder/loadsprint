"use client";

import { useState } from "react";
import { FileText, Sparkles, Eye } from "lucide-react";
import { useToast } from "@/components/toast";
import { PdfModal } from "@/components/pdf-modal";

type Stop = { address: string; time?: string };
export type ConfSeed = {
  ref?: string;
  rate?: string;
  billTo?: string;
  brokerName?: string;
  pickups: Stop[];
  dropoffs: Stop[];
};

// "Clean confirmation copy" — restates the load's key terms as a tidy,
// LoadSprint-formatted PDF you can edit (by hand or with AI) and open in a
// viewer or a new tab. The original broker PDF is always kept separately.
export function CleanConfirmation({
  driverName,
  originalPdfUrl,
  seed,
}: {
  driverName: string;
  originalPdfUrl?: string;
  seed: ConfSeed;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [viewer, setViewer] = useState<{ title: string; url: string; name: string } | null>(null);

  // Editable confirmation data.
  const [d, setD] = useState({
    ref: seed.ref || "",
    rate: seed.rate || "",
    brokerName: seed.brokerName || seed.billTo || "",
    brokerContact: "",
    billTo: seed.billTo || "",
    driverName,
    pickups: seed.pickups,
    dropoffs: seed.dropoffs,
    notes: "",
  });
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setD((s) => ({ ...s, [k]: e.target.value }));

  function payload() {
    return {
      ref: d.ref || undefined,
      rate: d.rate ? Number(d.rate) : undefined,
      brokerName: d.brokerName || undefined,
      brokerContact: d.brokerContact || undefined,
      billTo: d.billTo || undefined,
      driverName: d.driverName || undefined,
      pickups: d.pickups,
      dropoffs: d.dropoffs,
      notes: d.notes || undefined,
    };
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/confirmation-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast("Couldn't generate", data.error || "Try again.");
      } else {
        setViewer({ title: "Clean confirmation copy", url: data.dataUrl, name: `Confirmation ${d.ref || ""}.pdf` });
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function askAi() {
    if (!instruction.trim()) {
      toast("What should change?", "e.g. “rate is 2600, delivery is Houston, TX”.");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/confirmation-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload(), instruction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast("Couldn't edit", data.error || "Try again.");
      } else {
        const r = data.result;
        setD((s) => ({
          ...s,
          ref: r.ref ?? s.ref,
          rate: r.rate != null ? String(r.rate) : s.rate,
          brokerName: r.brokerName ?? s.brokerName,
          brokerContact: r.brokerContact ?? s.brokerContact,
          billTo: r.billTo ?? s.billTo,
          driverName: r.driverName ?? s.driverName,
          pickups: Array.isArray(r.pickups) ? r.pickups : s.pickups,
          dropoffs: Array.isArray(r.dropoffs) ? r.dropoffs : s.dropoffs,
          notes: r.notes ?? s.notes,
        }));
        setInstruction("");
        toast("Applied", "Edited the copy — generate to see the PDF.");
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="cc-panel">
      <div className="cc-head">
        <b><FileText size={15} /> Clean confirmation copy</b>
        {originalPdfUrl && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setViewer({ title: "Original rate confirmation", url: originalPdfUrl, name: "Rate Confirmation.pdf" })}
          >
            <Eye size={14} /> View original
          </button>
        )}
      </div>
      <p className="px" style={{ margin: "2px 0 12px" }}>
        A tidy PDF copy of this load’s terms. Edit below, generate, and open it in a viewer or a new tab.
        The broker’s original PDF stays untouched.
      </p>

      <div className="fgrid">
        <div className="field">
          <label>Broker / bill-to</label>
          <input value={d.brokerName} onChange={set("brokerName")} placeholder="Ace Freight Brokers" />
        </div>
        <div className="field">
          <label>Broker contact</label>
          <input value={d.brokerContact} onChange={set("brokerContact")} placeholder="email · phone" />
        </div>
        <div className="field">
          <label>Reference #</label>
          <input value={d.ref} onChange={set("ref")} placeholder="LS-48220" />
        </div>
        <div className="field">
          <label>Rate ($)</label>
          <input value={d.rate} onChange={set("rate")} inputMode="numeric" placeholder="2450" />
        </div>
        <div className="field full">
          <label>Notes</label>
          <input value={d.notes} onChange={set("notes")} placeholder="Detention after 2h, lumper reimbursed with receipt…" />
        </div>
      </div>

      <div className="cc-stops">
        <span>{d.pickups.length} pickup{d.pickups.length === 1 ? "" : "s"} · {d.dropoffs.length} delivery{d.dropoffs.length === 1 ? "" : "ies"} carried over from the read.</span>
      </div>

      <div className="cc-ai">
        <Sparkles size={14} />
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askAi()}
          placeholder="Ask AI to change something — e.g. “rate is 2600, delivery is Houston, TX”"
        />
        <button className="btn btn-ghost btn-sm" onClick={askAi} disabled={aiBusy}>
          {aiBusy ? "…" : "Apply"}
        </button>
      </div>

      <div className="cc-foot">
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={busy}>
          <FileText size={15} /> {busy ? "Generating…" : "Generate clean copy (PDF)"}
        </button>
      </div>

      {viewer && (
        <PdfModal title={viewer.title} dataUrl={viewer.url} fileName={viewer.name} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
