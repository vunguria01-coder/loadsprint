"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth";
import type { AccountTier } from "@/lib/schemas";
import { driverAllowance } from "@/lib/billing-plans";
import { useToast } from "@/components/toast";

// Admin grant options. "super" is a virtual choice that maps to tier=platinum
// plus planId=super_year (50 drivers). Everything else is a normal tier.
const planOptions = [
  { value: "none", label: "Free" },
  { value: "silver", label: "Silver (2 drivers)" },
  { value: "gold", label: "Gold (8 drivers)" },
  { value: "platinum", label: "Platinum (30 drivers)" },
  { value: "super", label: "Super (50 drivers)" },
];

function daysLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}
function planName(u: SafeUser): string {
  if (u.planId === "super_year") return "Super";
  if (u.tier === "none") return "Free";
  return u.tier[0].toUpperCase() + u.tier.slice(1);
}
function subLabel(u: SafeUser): string {
  if (u.tier === "none") return "No plan";
  const left = daysLeft(u.tierExpiresAt);
  if (left === null) return "No expiry";
  if (left < 0) return `Expired ${-left}d ago`;
  return `${left} day${left === 1 ? "" : "s"} left`;
}
// Which dropdown value reflects the user's current plan.
function currentValue(u: SafeUser): string {
  if (u.planId === "super_year") return "super";
  return u.tier;
}

export function AdminUserManager({
  users,
  extras = {},
  showFreeze = false,
}: {
  users: SafeUser[];
  extras?: Record<string, string>;
  showFreeze?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [draftPlan, setDraftPlan] = useState<Record<string, string>>({});
  const [draftDays, setDraftDays] = useState<Record<string, string>>({});

  async function patch(
    userId: string,
    body: { tier?: AccountTier; days?: number; planId?: string; canFreezeLocation?: boolean },
    successMsg: string
  ) {
    setBusy(userId);
    try {
      const res = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Update failed", data.error || "Try again.");
      else {
        toast("Saved", successMsg);
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function applyPlan(u: SafeUser, sel: string, days: number) {
    if (sel === "super") {
      patch(u.id, { tier: "platinum", planId: "super_year", days }, `${u.name}: Super granted.`);
    } else if (sel === "none") {
      patch(u.id, { tier: "none", planId: "", days: 0 }, `${u.name}'s plan removed.`);
    } else {
      patch(u.id, { tier: sel as AccountTier, planId: "", days }, `${u.name}: ${sel} granted.`);
    }
  }

  if (users.length === 0) return <p className="px">No registered accounts yet.</p>;

  return (
    <div className="am-list">
      {users.map((u) => {
        const sel = draftPlan[u.id] ?? currentValue(u);
        const daysVal = draftDays[u.id] ?? "30";
        const left = daysLeft(u.tierExpiresAt);
        const expired = u.tier !== "none" && left !== null && left < 0;
        const allowance = u.planId === "super_year" ? 50 : driverAllowance(undefined, u.tier);
        return (
          <div key={u.id} className="am-card" style={{ opacity: busy === u.id ? 0.55 : 1 }}>
            <div className="am-top">
              <div className="am-id">
                <div className="am-name">{u.name}</div>
                <div className="am-mail">{u.email}</div>
                {extras[u.id] && <div className="am-extra">{extras[u.id]}</div>}
              </div>
              <div className="am-plan">
                <span
                  className={`am-tier${u.planId === "super_year" ? " am-tier-super" : ""}`}
                  style={{ color: expired ? "#fca5a5" : undefined }}
                >
                  {planName(u)}
                </span>
                <span className="am-sub" style={{ color: expired ? "#fca5a5" : undefined }}>
                  {subLabel(u)}{u.tier !== "none" ? ` · ${allowance} drivers` : ""}
                </span>
              </div>
            </div>

            <div className="am-controls">
              <select
                value={sel}
                disabled={busy === u.id}
                onChange={(e) => setDraftPlan((d) => ({ ...d, [u.id]: e.target.value }))}
              >
                {planOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                title="Valid for N days (0 = forever / no expiry)"
                value={daysVal}
                disabled={busy === u.id || sel === "none"}
                onChange={(e) => setDraftDays((d) => ({ ...d, [u.id]: e.target.value }))}
                style={{ width: 72 }}
              />
              <span className="am-mail">days (0 = forever)</span>
              <button
                className="btn btn-primary"
                style={{ padding: "8px 16px" }}
                disabled={busy === u.id}
                onClick={() => applyPlan(u, sel, Number(daysVal) || 0)}
              >
                Apply
              </button>

              {showFreeze && (
                <label className="sw" style={{ marginLeft: "auto" }}>
                  <input
                    type="checkbox"
                    checked={u.canFreezeLocation}
                    disabled={busy === u.id}
                    onChange={(e) =>
                      patch(
                        u.id,
                        { canFreezeLocation: e.target.checked },
                        e.target.checked ? `Granted to ${u.name}.` : `Revoked from ${u.name}.`
                      )
                    }
                  />
                  <span className="track" />
                  <span className="sw-lbl">Freeze</span>
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
