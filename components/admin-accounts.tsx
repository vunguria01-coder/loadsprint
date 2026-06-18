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

export function AdminAccounts({ users }: { users: SafeUser[] }) {
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

  return (
    <div className="table-wrap">
      <table className="acc">
        <thead>
          <tr>
            <th>Account</th>
            <th>Role</th>
            <th>Current plan</th>
            <th>Grant / extend</th>
            <th>Location freeze</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const tierVal = draftTier[u.id] ?? u.tier;
            const daysVal = draftDays[u.id] ?? "30";
            const left = daysLeft(u.tierExpiresAt);
            const expired = u.tier !== "none" && left !== null && left < 0;
            return (
              <tr key={u.id} style={{ opacity: busy === u.id ? 0.55 : 1 }}>
                <td>
                  <div className="u-name">{u.name}</div>
                  <div className="u-mail">{u.email}</div>
                </td>
                <td>
                  <span className="role-pill">{u.role}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 700, textTransform: "capitalize" }}>
                    {u.tier === "none" ? "Free" : u.tier}
                  </div>
                  <div className="u-mail" style={{ color: expired ? "#fca5a5" : undefined }}>
                    {subLabel(u)}
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={tierVal}
                      disabled={busy === u.id}
                      onChange={(e) =>
                        setDraftTier((d) => ({ ...d, [u.id]: e.target.value as AccountTier }))
                      }
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
                      style={{ width: 64 }}
                    />
                    <span className="u-mail">days</span>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "6px 12px" }}
                      disabled={busy === u.id}
                      onClick={() =>
                        patch(
                          u.id,
                          { tier: tierVal, days: Number(daysVal) || 0 },
                          tierVal === "none"
                            ? `${u.name}'s plan removed.`
                            : `${u.name}: ${tierVal} updated.`
                        )
                      }
                    >
                      Apply
                    </button>
                  </div>
                </td>
                <td>
                  <label className="sw">
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
                    <span className="sw-lbl">{u.canFreezeLocation ? "Granted" : "Off"}</span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
