"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "@/components/toast";
import { EQUIPMENT_TYPES, EQUIPMENT_LABELS, DIRECTIONS, DIRECTION_LABELS } from "@/lib/truck-constants";
import type { DriverSearchProfileValues } from "@/lib/schemas";

const EMPTY: DriverSearchProfileValues = {
  equipment: "",
  trailerLengthFt: undefined,
  deadheadRadiusMi: undefined,
  preferredDirections: [],
  minRatePerMile: undefined,
};

// Load-search preferences for one driver — equipment, trailer length,
// deadhead radius, preferred run directions, minimum rate per mile. A
// blank field means "no filter" on that dimension. This only stores the
// profile; no search runs from here, and no external load API is wired
// up yet.
export function DriverSearchProfileForm({ email }: { email: string }) {
  const toast = useToast();
  const [form, setForm] = useState<DriverSearchProfileValues>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/driver-search-profile?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (!cancelled && data.ok && data.profile) {
          setForm({ ...EMPTY, ...data.profile });
        }
      } catch {
        /* ignore — form just starts empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  function set<K extends keyof DriverSearchProfileValues>(k: K, v: DriverSearchProfileValues[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleDirection(d: string) {
    const cur = form.preferredDirections || [];
    set(
      "preferredDirections",
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    );
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/driver-search-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Save failed", data.error || "Try again.");
      else toast("Saved", "Load-search profile updated.");
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="px">Loading…</p>;

  return (
    <div className="panel">
      <h3>Load-search profile</h3>
      <p className="px">
        Filters for a future &quot;find loads for this driver&quot; search. Leave a field
        blank to mean no filter on that dimension.
      </p>

      <div className="fgrid">
        <div className="field">
          <label>Equipment</label>
          <select value={form.equipment} onChange={(e) => set("equipment", e.target.value)}>
            <option value="">Any</option>
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EQUIPMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Trailer length (ft)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={form.trailerLengthFt ?? ""}
            onChange={(e) =>
              set("trailerLengthFt", e.target.value === "" ? undefined : Number(e.target.value))
            }
            placeholder="53"
          />
        </div>
        <div className="field">
          <label>Deadhead radius (mi)</label>
          <input
            type="number"
            min={0}
            max={2000}
            value={form.deadheadRadiusMi ?? ""}
            onChange={(e) =>
              set("deadheadRadiusMi", e.target.value === "" ? undefined : Number(e.target.value))
            }
            placeholder="150"
          />
        </div>
        <div className="field">
          <label>Minimum rate per mile ($)</label>
          <input
            type="number"
            min={0}
            max={50}
            step="0.01"
            value={form.minRatePerMile ?? ""}
            onChange={(e) =>
              set("minRatePerMile", e.target.value === "" ? undefined : Number(e.target.value))
            }
            placeholder="2.00"
          />
        </div>
        <div className="field full">
          <label>Preferred directions</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {DIRECTIONS.map((d) => (
              <label key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={(form.preferredDirections || []).includes(d)}
                  onChange={() => toggleDirection(d)}
                />
                {DIRECTION_LABELS[d]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
