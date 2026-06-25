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
            `Join code generated (${data.used}/${data.limit} drivers used).`
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

  const appBase =
    process.env.NEXT_PUBLIC_DRIVER_APP_URL || "https://loadsprint.app/driver";

  function copyLink(code: string) {
    const link = `${appBase}?code=${code}`;
    navigator.clipboard?.writeText(link);
    toast("Link copied", "App invite link is on your clipboard.");
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    toast("Code copied", "Send this code to your driver — they enter it in the app.");
  }

  return (
    <div className="add-driver">
      <h3>
        <UserPlus size={17} style={{ verticalAlign: "-3px", marginRight: 6 }} />
        Add a driver
      </h3>
      <p className="sx">
        Enter the driver&apos;s email and send the invite. You&apos;ll get a join
        code — give it to your driver, and they enter it in the LoadSprint driver
        app under &ldquo;Register with code.&rdquo;
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
              <div style={{ display: "flex", gap: 8 }}>
                <button className="copy-link" onClick={() => copyCode(iv.code)}>
                  Copy code
                </button>
                <button className="copy-link" onClick={() => copyLink(iv.code)}>
                  Copy app link
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
