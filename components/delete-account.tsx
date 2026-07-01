"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function remove() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        window.location.href = "/";
      } else {
        setErr(d.error || "Could not delete the account. Please try again.");
        setBusy(false);
      }
    } catch {
      setErr("Could not delete the account. Please try again.");
      setBusy(false);
    }
  }

  const ready = confirm.trim().toUpperCase() === "DELETE";

  return (
    <div className="danger-zone">
      <h3>Delete account</h3>
      <p className="px">
        Permanently delete your account and remove your personal data. This can&apos;t
        be undone.
      </p>
      <button type="button" className="danger-btn" onClick={() => setOpen(true)}>
        <Trash2 size={15} /> Delete my account
      </button>

      {open && (
        <>
          <div className="pkg-scrim" onClick={() => !busy && setOpen(false)} />
          <div className="pkg-modal" role="dialog" aria-label="Delete account">
            <div className="pkg-modal-head">
              <div>
                <div className="pkg-eyebrow" style={{ color: "#f87171" }}>
                  Delete account
                </div>
                <div className="pkg-modal-title">This can&apos;t be undone</div>
              </div>
              <button
                type="button"
                className="pkg-x"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="pkg-sub">
              Your account and personal data will be permanently deleted. Type{" "}
              <b>DELETE</b> to confirm.
            </p>
            <input
              className="da-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
            {err && <p className="da-err">{err}</p>}
            <div className="pkg-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => !busy && setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={remove}
                disabled={busy || !ready}
              >
                {busy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
