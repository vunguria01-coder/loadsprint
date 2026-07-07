"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Copy, Trash2, Link2, Globe } from "lucide-react";
import { useToast } from "@/components/toast";
import type { DriverInvite } from "@/lib/invites";

export function DriverManager({ invites }: { invites: DriverInvite[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const appBase =
    process.env.NEXT_PUBLIC_DRIVER_APP_URL || "https://loadsprint.app/driver";
  const appStore =
    process.env.NEXT_PUBLIC_IOS_APP_STORE_URL || "https://apps.apple.com/app/id6785073294";

  async function invite() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast("Check the email", "Enter a valid driver email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/driver-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not invite", data.error || "Try again.");
      } else {
        toast("Driver invited", "Share the join code with your driver.");
        setEmail("");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/driver-invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not remove", data.error || "Try again.");
      } else {
        toast("Removed", "Driver invite removed.");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const siteBase = typeof window !== "undefined" ? window.location.origin : "";
  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    toast("Code copied", "Send this code to your driver.");
  }
  // Website link — opens in any phone browser, no app needed. The reliable way
  // to onboard a driver without depending on email. Copies a full paste-ready
  // message (site link + app link + code) for WhatsApp/SMS.
  function copySite(code: string) {
    const msg =
      `You're invited to LoadSprint as a driver.\n\n` +
      `Open this on your phone, register with the code, then tap "Share":\n` +
      `${siteBase}/driver?code=${code}\n\n` +
      `Prefer the app? ${appStore}\n` +
      `Your join code: ${code}`;
    navigator.clipboard?.writeText(msg);
    toast("Invite copied", "Paste it to your driver (WhatsApp, SMS…). Website link works with no app.");
  }
  function copyLink(code: string) {
    navigator.clipboard?.writeText(`${appBase}?code=${code}`);
    toast("App link copied", "The driver-app invite link is on your clipboard.");
  }

  return (
    <>
      <button className="btn btn-primary dm-trigger" onClick={() => setOpen(true)}>
        <UserPlus size={17} /> Add driver
      </button>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="box dm-box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>Manage drivers</b>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="dm-body">
              <p className="dm-sx">
                Enter a driver&apos;s email to invite them. We&apos;ll email a join code —
                but the reliable way (while email warms up) is the <b>website link</b>:
                tap the globe icon to copy an invite, send it (WhatsApp, SMS…), and your
                driver opens it on their phone, registers with the code, and taps
                &ldquo;Share&rdquo; to send their location — no app needed.
              </p>

              <div className="dm-add">
                <input
                  type="email"
                  placeholder="driver@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && invite()}
                />
                <button className="btn btn-primary" onClick={invite} disabled={busy}>
                  {busy ? "…" : "Invite"}
                </button>
              </div>

              <div className="dm-list">
                {invites.length === 0 ? (
                  <div className="dm-empty">No drivers invited yet.</div>
                ) : (
                  invites.map((iv) => (
                    <div className="dm-row" key={iv.id}>
                      <div className="dm-info">
                        <div className="dm-email">{iv.email}</div>
                        <div className="dm-code">{iv.code}</div>
                      </div>
                      <span className={`dm-status dm-${iv.status}`}>
                        {iv.status === "claimed" ? "✓ registered" : "pending"}
                      </span>
                      <div className="dm-actions">
                        <button title="Copy website invite (no app needed)" onClick={() => copySite(iv.code)}>
                          <Globe size={15} />
                        </button>
                        <button title="Copy code" onClick={() => copyCode(iv.code)}>
                          <Copy size={15} />
                        </button>
                        <button title="Copy app link" onClick={() => copyLink(iv.code)}>
                          <Link2 size={15} />
                        </button>
                        <button title="Remove" className="dm-del" onClick={() => remove(iv.id)} disabled={busy}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
