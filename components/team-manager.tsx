"use client";

import { useEffect, useRef, useState } from "react";
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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = boxRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

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
      setConfirmId(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    toast("Code copied", "Send this code to your dispatcher.");
  }

  return (
    <>
      <button ref={triggerRef} className="btn btn-primary dm-trigger" onClick={() => setOpen(true)}>
        <UserPlus size={17} /> Add dispatcher
      </button>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div ref={boxRef} className="box dm-box" role="dialog" aria-modal="true" aria-labelledby="dm-title" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b id="dm-title">Add a dispatcher</b>
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
                        {confirmId === iv.id ? (
                          <>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => remove(iv.id)}
                              disabled={busy}
                            >
                              {busy ? "…" : "Confirm"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button title="Copy code" onClick={() => copyCode(iv.code)}>
                              <Copy size={15} />
                            </button>
                            <button title="Remove" className="dm-del" onClick={() => setConfirmId(iv.id)} disabled={busy}>
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
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
