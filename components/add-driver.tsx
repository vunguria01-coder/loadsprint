"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useToast } from "@/components/toast";
import type { DriverInvite } from "@/lib/invites";

export function AddDriver({ invites }: { invites: DriverInvite[] }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

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
        if (data.extra) {
          toast(
            "Driver added (extra)",
            `Beyond your plan limit of ${data.limit}. This driver adds $${data.extraPrice}/mo.`
          );
        } else {
          toast(
            "Driver invited",
            data.emailed
              ? `Invite emailed to ${value}. (${data.used}/${data.limit} drivers used)`
              : data.emailSkipped
              ? `Join code generated — email not set up yet (${data.used}/${data.limit} drivers used).`
              : `Join code generated, but the email didn't send. Share the code/link manually.`
          );
        }
        setEmail("");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const appStoreUrl =
    process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ||
    "https://apps.apple.com/app/id6785073294";

  const siteLink = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/driver?code=${code}` : `/driver?code=${code}`;

  // A ready-to-send message the dispatcher can paste into WhatsApp/SMS/etc.
  // Leads with the website link (works in any phone browser, no app needed) so
  // onboarding never depends on email being delivered.
  function copyInvite(code: string) {
    const msg =
      `You're invited to LoadSprint as a driver.\n\n` +
      `Open this link on your phone, register with the code, then tap "Share":\n` +
      `${siteLink(code)}\n\n` +
      `Prefer the app? ${appStoreUrl}\n` +
      `Your join code: ${code}`;
    navigator.clipboard?.writeText(msg);
    toast("Invite copied", "Paste it to your driver in WhatsApp, SMS or any chat.");
  }

  function copySite(code: string) {
    navigator.clipboard?.writeText(siteLink(code));
    toast("Website link copied", "Send it — your driver opens it in any phone browser.");
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    toast("Code copied", "Send this code to your driver — they enter it on the site or app.");
  }

  return (
    <div className="add-driver">
      <h3>
        <UserPlus size={17} style={{ verticalAlign: "-3px", marginRight: 6 }} />
        Add a driver
      </h3>
      <p className="sx">
        Enter the driver&apos;s email to generate a join code. We&apos;ll email it —
        but while email is still warming up, the reliable way is to tap
        &ldquo;Copy invite&rdquo; (or &ldquo;Site link&rdquo;) and send it yourself
        (WhatsApp, SMS…). Your driver opens the <b>website link on their phone</b>,
        registers with the code, and taps &ldquo;Share&rdquo; to send their
        location — no app install needed. They can also use the driver app.
      </p>
      <div className="row">
        <input
          type="email"
          placeholder="driver@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
        />
        <button className="btn btn-primary" onClick={invite} disabled={busy}>
          {busy ? "Sending…" : "Send invite"}
        </button>
      </div>

      {invites.length > 0 && (
        <div className="invite-list">
          {invites.map((iv) => (
            <div className="invite" key={iv.id}>
              <span className="ie">{iv.email}</span>
              <span className="ic">{iv.code}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="copy-link" onClick={() => copyInvite(iv.code)}>
                  Copy invite
                </button>
                <button className="copy-link" onClick={() => copySite(iv.code)}>
                  Site link
                </button>
                <button className="copy-link" onClick={() => copyCode(iv.code)}>
                  Copy code
                </button>
              </div>
              <span className={`ist ist-${iv.status}`}>
                {iv.status === "claimed" ? "✓ registered" : "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
