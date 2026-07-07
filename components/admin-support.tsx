"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, CheckCircle2, RefreshCw, RotateCcw } from "lucide-react";
import { useToast } from "@/components/toast";
import type { SupportTicket } from "@/lib/support";

const CAT_LABEL: Record<string, string> = {
  question: "Question",
  bug: "Bug",
  account: "Account",
  billing: "Billing",
  feature: "Feature",
  other: "Other",
};

export function AdminSupport({ tickets }: { tickets: SupportTicket[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, t.reply || t.aiDraftReply || ""]))
  );

  async function act(id: string, body: Record<string, unknown>, ok: string) {
    setBusy(id + String(body.action));
    try {
      const r = await fetch(`/api/support/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) toast("Failed", d.error || "Try again.");
      else {
        toast("Done", ok);
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy("");
    }
  }

  if (tickets.length === 0) {
    return <div className="empty">No support tickets yet.</div>;
  }

  return (
    <div className="asup-list">
      {tickets.map((t) => {
        const draft = drafts[t.id] ?? "";
        return (
          <div key={t.id} className={`asup-card st-${t.status}`}>
            <div className="asup-head">
              <div className="asup-who">
                <b>{t.subject}</b>
                <span className="asup-meta">
                  {t.userName} · {t.userEmail} · {t.userRole} · {new Date(t.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="asup-tags">
                {t.category && <span className="asup-tag">{CAT_LABEL[t.category] || t.category}</span>}
                {t.severity && <span className={`asup-sev sev-${t.severity}`}>{t.severity}</span>}
                <span className={`asup-status stx-${t.status}`}>
                  {t.status === "new" ? "New" : t.status === "answered" ? "Answered" : "Resolved"}
                </span>
              </div>
            </div>

            <div className="asup-msg">{t.message}</div>

            {t.aiReport ? (
              <div className="asup-report">
                <div className="asup-report-tag">
                  <Sparkles size={13} /> AI report (internal)
                </div>
                <div>{t.aiReport}</div>
              </div>
            ) : (
              <div className="asup-noai">
                No AI triage yet.{" "}
                <button className="link" onClick={() => act(t.id, { action: "retriage" }, "Triaged.")}>
                  Run AI
                </button>
              </div>
            )}

            <div className="asup-reply">
              <label>Reply to {t.userName.split(" ")[0]}</label>
              <textarea
                value={draft}
                onChange={(e) => setDrafts((s) => ({ ...s, [t.id]: e.target.value }))}
                rows={4}
                placeholder="Write a reply, or edit the AI draft…"
              />
              <div className="asup-actions">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy !== "" || !draft.trim()}
                  onClick={() => act(t.id, { action: "reply", reply: draft }, "Reply sent.")}
                >
                  <Send size={15} /> {t.reply ? "Update reply" : "Send reply"}
                </button>
                {t.aiDraftReply && draft !== t.aiDraftReply && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDrafts((s) => ({ ...s, [t.id]: t.aiDraftReply || "" }))}
                  >
                    <RotateCcw size={14} /> Reset to AI draft
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy !== ""}
                  onClick={() => act(t.id, { action: "retriage" }, "Re-triaged.")}
                >
                  <RefreshCw size={14} /> Re-run AI
                </button>
                {t.status !== "resolved" ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== ""}
                    onClick={() => act(t.id, { action: "status", status: "resolved" }, "Resolved.")}
                  >
                    <CheckCircle2 size={15} /> Mark resolved
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== ""}
                    onClick={() => act(t.id, { action: "status", status: "new" }, "Reopened.")}
                  >
                    Reopen
                  </button>
                )}
              </div>
              {t.reply && (
                <div className="asup-sent">
                  Sent {t.repliedAt ? new Date(t.repliedAt).toLocaleString() : ""}
                  {t.repliedBy ? ` · ${t.repliedBy}` : ""}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
