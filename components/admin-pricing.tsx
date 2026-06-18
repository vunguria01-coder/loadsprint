"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import type { PricingValues } from "@/lib/schemas";

export function AdminPricing({ pricing }: { pricing: PricingValues }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<PricingValues>(pricing);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PricingValues>(key: K, value: PricingValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Save failed", data.error || "Check the values.");
      } else {
        toast("Prices updated", "New prices are live on the pricing page.");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="price-edit">
        {(["silver", "gold", "platinum"] as const).map((t) => (
          <div className="pe" key={t}>
            <div className={`pt tier-${t}`} style={{ color: "var(--ink)" }}>
              {t}
            </div>
            <input
              type="number"
              min={0}
              value={form[t]}
              onChange={(e) => set(t, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
      <div className="meta-row">
        <div className="field">
          <label>Currency symbol</label>
          <input
            value={form.currency}
            maxLength={4}
            onChange={(e) => set("currency", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Billing period label</label>
          <input
            value={form.period}
            maxLength={12}
            onChange={(e) => set("period", e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn btn-primary"
        style={{ marginTop: 18 }}
        onClick={save}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save prices"}
      </button>
    </>
  );
}
