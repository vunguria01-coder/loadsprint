"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import type { DriverInvite } from "@/lib/invites";

export function TeamManager({ invites }: { invites: DriverInvite[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast("Check the email", "Enter a valid dispatcher email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dispatcher-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not invite", data.error || "Try again.");
      } else {
        toast("Dispatcher invited", data.emailSkipped ? "Share the code below." : "Invite code emailed.");
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
      const res = await fetch("/api/dispatcher-invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not remove", data.error || "Try again.");
      } else {
        toast("Removed", "Invite removed.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    toast("Code copied", "Send this code to your dispatcher.");
  }

  return (
    <>
      <button className="btn btn-primary dm-trigger" onClick={() => setOpen(true)}>
        <UserPlus size={17} /> Add dispatcher
      </button>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="box dm-box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>Add a dispatcher</b>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="dm-body">
              <p className="dm-sx">
                Enter their email to invite them. They’ll get a code to create a
                dispatcher login on the website under “Register with code.” They
                share your plan — no separate subscription.
              </p>

              <div className="dm-add">
                <input
                  type="email"
                  placeholder="dispatcher@email.com"
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
                  <div className="dm-empty">No dispatchers invited yet.</div>
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
                        <button title="Copy code" onClick={() => copyCode(iv.code)}>
                          <Copy size={15} />
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
