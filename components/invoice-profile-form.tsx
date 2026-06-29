"use client";

import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { useToast } from "@/components/toast";
import type { InvoiceProfile } from "@/lib/schemas";

const EMPTY: InvoiceProfile = {
  companyName: "",
  address: "",
  phone: "",
  email: "",
  payTerms: "",
  notes: "",
};

export function InvoiceProfileForm() {
  const toast = useToast();
  const [form, setForm] = useState<InvoiceProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const contact = [form.phone, form.email].filter(Boolean).join("  ·  ");

  return (
    <div className="inv-settings">
      <div className="inv-form panel">
        <h3>
          <Building2 /> Invoice details
        </h3>
        <p className="px">
          Entered once and remembered — these appear at the top of every invoice you create.
        </p>

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
          <div className="field full">
            <label>Payment terms</label>
            <input value={form.payTerms} onChange={(e) => set("payTerms", e.target.value)} placeholder="Net 30 — pay to ..." />
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
          <div className="inv-doc-band">INVOICE</div>
          <div className="inv-doc-body">
            <div className="idf-name">{form.companyName || "Your company LLC"}</div>
            <div className="idf-line">{form.address || "Street, City, State ZIP"}</div>
            {contact && <div className="idf-line">{contact}</div>}
            <div className="inv-doc-rows">
              <div className="inv-doc-row"><span>Line haul</span><span>$2,400</span></div>
              <div className="inv-doc-row idr-total"><span>Total</span><span>$2,400</span></div>
            </div>
            {form.payTerms && <div className="inv-doc-terms">{form.payTerms}</div>}
            <div className="inv-doc-foot">{form.notes || "Thank you for your business."}</div>
          </div>
        </div>
        <p className="inv-preview-hint">This is how the header of your invoices will look.</p>
      </div>
    </div>
  );
}
