"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth";
import type { AccountTier } from "@/lib/schemas";
import { useToast } from "@/components/toast";

const tierOptions: AccountTier[] = ["none", "silver", "gold", "platinum"];

export function AdminAccounts({ users }: { users: SafeUser[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(
    userId: string,
    body: { tier?: AccountTier; canFreezeLocation?: boolean },
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
      if (!res.ok || !data.ok) {
        toast("Update failed", data.error || "Try again.");
      } else {
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
            <th>Subscription</th>
            <th>Location freeze</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ opacity: busy === u.id ? 0.55 : 1 }}>
              <td>
                <div className="u-name">{u.name}</div>
                <div className="u-mail">{u.email}</div>
              </td>
              <td>
                <span className="role-pill">{u.role}</span>
              </td>
              <td>
                <select
                  value={u.tier}
                  disabled={busy === u.id}
                  onChange={(e) =>
                    patch(
                      u.id,
                      { tier: e.target.value as AccountTier },
                      `${u.name}'s plan updated.`
                    )
                  }
                >
                  {tierOptions.map((t) => (
                    <option key={t} value={t}>
                      {t === "none" ? "Free" : t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
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
                        e.target.checked
                          ? `Granted to ${u.name}.`
                          : `Revoked from ${u.name}.`
                      )
                    }
                  />
                  <span className="track" />
                  <span className="sw-lbl">
                    {u.canFreezeLocation ? "Granted" : "Off"}
                  </span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
