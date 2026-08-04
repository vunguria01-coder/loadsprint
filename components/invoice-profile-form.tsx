"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Save, Trash2, Upload } from "lucide-react";
import { useToast } from "@/components/toast";
import { fileToDataUrl } from "@/lib/format";
import type { InvoiceProfile } from "@/lib/schemas";

const EMPTY: InvoiceProfile = {
  companyName: "",
  address: "",
  phone: "",
  email: "",
  payTerms: "",
  notes: "",
  logoDataUrl: "",
  taxId: "",
  terms: "NET 30",
  termsDays: 30,
  taxPercent: 0,
  nextInvoiceNumber: 1001,
};

// Logos come off a phone camera or a website at any size. Redraw to at most
// 300px on the long edge as PNG so the profile JSON stays small and pdf-lib can
// embed it directly.
function shrinkLogo(dataUrl: string, max = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = dataUrl;
  });
}

export function InvoiceProfileForm() {
  const toast = useToast();
  const [form, setForm] = useState<InvoiceProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/invoice-profile");
        const data = await res.json();
        if (data.ok && data.profile) setForm({ ...EMPTY, ...data.profile });
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set<K extends keyof InvoiceProfile>(k: K, v: InvoiceProfile[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function pickLogo(file?: File) {
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      const small = await shrinkLogo(raw);
      set("logoDataUrl", small);
      toast("Logo added", "Save the details to keep it on your invoices.");
    } catch {
      toast("Could not read the image", "Try a PNG or JPG file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/invoice-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Save failed", data.error || "Try again.");
      else toast("Saved", "Your invoice details are remembered.");
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="px">Loading…</p>;

  return (
    <div className="inv-settings">
      <div className="inv-form panel">
        <h3>
          <Building2 /> Invoice details
        </h3>
        <p className="px">
          Entered once and remembered — these appear at the top of every invoice you create.
        </p>

        <div className="inv-group-label">Logo</div>
        <div className="invx-logo-row">
          {form.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="invx-logo" src={form.logoDataUrl} alt="Company logo" />
          ) : (
            <div className="invx-logo invx-logo-empty">No logo</div>
          )}
          <div className="invx-logo-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> {form.logoDataUrl ? "Replace logo" : "Upload logo"}
            </button>
            {form.logoDataUrl && (
              <button className="btn btn-ghost" onClick={() => set("logoDataUrl", "")}>
                <Trash2 size={15} /> Remove
              </button>
            )}
            <span className="invx-hint">PNG or JPG. Printed top-left on the invoice.</span>
          </div>
        </div>

        <div className="inv-group-label">Company</div>
        <div className="fgrid">
          <div className="field full">
            <label>Company name</label>
            <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Your company LLC" />
          </div>
          <div className="field full">
            <label>Address</label>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City, State ZIP" />
          </div>
          <div className="field full">
            <label>Tax Registration #</label>
            <input value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="45-1286612" />
          </div>
        </div>

        <div className="inv-group-label">Contact</div>
        <div className="fgrid">
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 000-0000" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="billing@company.com" />
          </div>
        </div>

        <div className="inv-group-label">Invoice</div>
        <div className="fgrid">
          <div className="field">
            <label>Terms</label>
            <input value={form.terms} onChange={(e) => set("terms", e.target.value)} placeholder="NET 30" />
          </div>
          <div className="field">
            <label>Days until due</label>
            <input
              type="number"
              min={0}
              max={365}
              value={form.termsDays}
              onChange={(e) => set("termsDays", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Default TAX %</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.taxPercent}
              onChange={(e) => set("taxPercent", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Next invoice number</label>
            <input
              type="number"
              min={1}
              value={form.nextInvoiceNumber}
              onChange={(e) => set("nextInvoiceNumber", Number(e.target.value))}
            />
          </div>
          <div className="field full">
            <label>Payment instructions (optional)</label>
            <input value={form.payTerms} onChange={(e) => set("payTerms", e.target.value)} placeholder="Pay by ACH to ..." />
          </div>
          <div className="field full">
            <label>Footer note (optional)</label>
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Thank you for your business." />
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save details"}
        </button>
      </div>

      <div className="inv-preview">
        <div className="inv-preview-label">Live preview</div>
        <div className="inv-doc">
          <div className="inv-doc-body invx-doc">
            <div className="invx-doc-top">
              {form.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="invx-doc-logo" src={form.logoDataUrl} alt="" />
              ) : (
                <div className="invx-doc-logo invx-doc-logo-empty" />
              )}
              <div className="invx-doc-meta">
                <div>{form.address || "Street, City, State ZIP"}</div>
                {form.email && <div>{form.email}</div>}
                {form.phone && <div>{form.phone}</div>}
                {form.taxId && <div>Tax Registration #: {form.taxId}</div>}
              </div>
            </div>
            <div className="invx-doc-title">
              <span className="invx-doc-name">{form.companyName || "Your company LLC"}</span>
              <span className="invx-doc-word">Invoice</span>
            </div>
            <div className="invx-doc-grid">
              <div>
                <b>Bill To:</b>
                <div>Broker from the rate con</div>
              </div>
              <div className="invx-doc-right">
                <div><b>Invoice No:</b> {form.nextInvoiceNumber}</div>
                <div><b>Terms:</b> {form.terms || "—"}</div>
                <div><b>Due:</b> in {form.termsDays} days</div>
              </div>
            </div>
            <div className="invx-doc-table">
              <div className="invx-doc-thead">
                <span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span>
              </div>
              <div className="invx-doc-trow">
                <span>Pickup / Delivery stops</span><span>1</span><span>$2,100.00</span><span>$2,100.00</span>
              </div>
            </div>
            <div className="inv-doc-rows">
              <div className="inv-doc-row"><span>Subtotal</span><span>$2,100.00</span></div>
              <div className="inv-doc-row"><span>TAX {form.taxPercent}%</span><span>$0.00</span></div>
              <div className="inv-doc-row"><span>PAID</span><span>$0.00</span></div>
              <div className="inv-doc-row idr-total"><span>Balance Due</span><span>$2,100.00</span></div>
            </div>
            {form.notes && <div className="inv-doc-foot">{form.notes}</div>}
          </div>
        </div>
        <p className="inv-preview-hint">This is how your invoices will look.</p>
      </div>
    </div>
  );
}
