"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import type { LimitsValues } from "@/lib/schemas";

export function AdminLimits({ limits }: { limits: LimitsValues }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<LimitsValues>(limits);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof LimitsValues>(key: K, value: LimitsValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Save failed", data.error || "Check values.");
      else {
        toast("Limits updated", "Driver limits saved.");
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
            <div className="pt" style={{ color: "var(--ink)" }}>
              {t} — drivers
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
          <label>Extra driver price (per driver, per period)</label>
          <input
            type="number"
            min={0}
            value={form.extraDriverPrice}
            onChange={(e) => set("extraDriverPrice", Number(e.target.value))}
          />
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save limits"}
      </button>
    </>
  );
}
