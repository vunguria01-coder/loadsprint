"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth";
import type { AccountTier } from "@/lib/schemas";
import { useToast } from "@/components/toast";

const tierOptions: AccountTier[] = ["none", "silver", "gold", "platinum"];

function daysLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}
function subLabel(u: SafeUser): string {
  if (u.tier === "none") return "No plan";
  const left = daysLeft(u.tierExpiresAt);
  if (left === null) return "No expiry";
  if (left < 0) return `Expired ${-left}d ago`;
  return `${left} day${left === 1 ? "" : "s"} left`;
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
  const [draftTier, setDraftTier] = useState<Record<string, AccountTier>>({});
  const [draftDays, setDraftDays] = useState<Record<string, string>>({});

  async function patch(
    userId: string,
    body: { tier?: AccountTier; days?: number; canFreezeLocation?: boolean },
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

  if (users.length === 0) return <p className="px">No registered accounts yet.</p>;

  return (
    <div className="am-list">
      {users.map((u) => {
        const tierVal = draftTier[u.id] ?? u.tier;
        const daysVal = draftDays[u.id] ?? "30";
        const left = daysLeft(u.tierExpiresAt);
        const expired = u.tier !== "none" && left !== null && left < 0;
        return (
          <div key={u.id} className="am-card" style={{ opacity: busy === u.id ? 0.55 : 1 }}>
            <div className="am-top">
              <div className="am-id">
                <div className="am-name">{u.name}</div>
                <div className="am-mail">{u.email}</div>
                {extras[u.id] && <div className="am-extra">{extras[u.id]}</div>}
              </div>
              <div className="am-plan">
                <span className="am-tier" style={{ color: expired ? "#fca5a5" : undefined }}>
                  {u.tier === "none" ? "Free" : u.tier}
                </span>
                <span className="am-sub" style={{ color: expired ? "#fca5a5" : undefined }}>{subLabel(u)}</span>
              </div>
            </div>

            <div className="am-controls">
              <select
                value={tierVal}
                disabled={busy === u.id}
                onChange={(e) => setDraftTier((d) => ({ ...d, [u.id]: e.target.value as AccountTier }))}
              >
                {tierOptions.map((t) => (
                  <option key={t} value={t}>
                    {t === "none" ? "Free" : t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                title="Days (0 = no expiry)"
                value={daysVal}
                disabled={busy === u.id || tierVal === "none"}
                onChange={(e) => setDraftDays((d) => ({ ...d, [u.id]: e.target.value }))}
                style={{ width: 72 }}
              />
              <span className="am-mail">days</span>
              <button
                className="btn btn-primary"
                style={{ padding: "8px 16px" }}
                disabled={busy === u.id}
                onClick={() =>
                  patch(
                    u.id,
                    { tier: tierVal, days: Number(daysVal) || 0 },
                    tierVal === "none" ? `${u.name}'s plan removed.` : `${u.name}: ${tierVal} updated.`
                  )
                }
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
