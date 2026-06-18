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

  return (
    <div className="panel">
      <h3>
        <Building2 /> Invoice details
      </h3>
      <p className="px">
        Entered once and remembered — these appear at the top of every invoice you
        create.
      </p>
      <div className="fgrid">
        <div className="field full">
          <label>Company name</label>
          <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Your company LLC" />
        </div>
        <div className="field full">
          <label>Address</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City, State ZIP" />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 000-0000" />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="billing@company.com" />
        </div>
        <div className="field full">
          <label>Payment terms</label>
          <input value={form.payTerms} onChange={(e) => set("payTerms", e.target.value)} placeholder="Net 30 — pay to ..." />
        </div>
        <div className="field full">
          <label>Footer note (optional)</label>
          <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Thank you for your business." />
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? "Saving…" : "Save details"}
      </button>
    </div>
  );
}
