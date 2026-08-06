"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Send, CheckCircle2, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, t.reply || t.aiDraftReply || ""]))
  );

  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [status, setStatus] = useState<"" | "open" | "resolved">(
    () => (searchParams.get("status") as "open" | "resolved") || ""
  );
  const [sort, setSort] = useState<"" | "oldest">(() => (searchParams.get("sort") as "oldest") || "");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, sort]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const openCount = tickets.filter((t) => t.status !== "resolved").length;
  const resolvedCount = tickets.length - openCount;

  const query = q.trim().toLowerCase();
  const shown = tickets
    .filter((t) => !status || (status === "resolved" ? t.status === "resolved" : t.status !== "resolved"))
    .filter(
      (t) =>
        !query ||
        t.subject.toLowerCase().includes(query) ||
        t.userName.toLowerCase().includes(query) ||
        t.userEmail.toLowerCase().includes(query)
    )
    .sort((a, b) => (sort === "oldest" ? (a.createdAt > b.createdAt ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <div className="lb-controls">
        <div className="driver-search lb-search">
          <Search size={18} />
          <input
            ref={searchRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              if (q) setQ("");
              else (e.target as HTMLInputElement).blur();
            }}
            placeholder="Search by subject, name or email… (press /)"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")}>✕</button>
          )}
        </div>
        <select className="lb-status" value={status} onChange={(e) => setStatus(e.target.value as "" | "open" | "resolved")}>
          <option value="">All ({tickets.length})</option>
          <option value="open">Open ({openCount})</option>
          <option value="resolved">Resolved ({resolvedCount})</option>
        </select>
        <select className="lb-status" value={sort} onChange={(e) => setSort(e.target.value as "" | "oldest")}>
          <option value="">Sort: newest</option>
          <option value="oldest">Oldest</option>
        </select>
        {(q || status || sort) && (
          <button type="button" className="lb-clear-filters" onClick={() => { setQ(""); setStatus(""); setSort(""); }}>
            Clear filters
          </button>
        )}
      </div>
      {(query || status || sort) && (
        <div className="lb-filter-chips">
          {query && (
            <span className="lb-filter-chip">
              Search: "{q}"
              <button type="button" onClick={() => setQ("")} aria-label="Clear search">✕</button>
            </span>
          )}
          {status && (
            <span className="lb-filter-chip">
              {status === "open" ? "Open" : "Resolved"}
              <button type="button" onClick={() => setStatus("")} aria-label="Clear status filter">✕</button>
            </span>
          )}
          {sort && (
            <span className="lb-filter-chip">
              Sort: Oldest
              <button type="button" onClick={() => setSort("")} aria-label="Clear sort">✕</button>
            </span>
          )}
        </div>
      )}
      {(query || status) && (
        <p className="lb-count" aria-live="polite">
          {shown.length} of {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No matching tickets"
          sub={query ? `No tickets match "${q}".` : "No tickets match this filter."}
          action={
            <button type="button" className="lb-clear-filters" onClick={() => { setQ(""); setStatus(""); setSort(""); }}>
              Clear filters
            </button>
          }
        />
      ) : (
      <div className="asup-list">
      {shown.map((t) => {
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
                <button
                  className="link"
                  disabled={busy !== ""}
                  onClick={() => act(t.id, { action: "retriage" }, "Triaged.")}
                >
                  {busy === t.id + "retriage" ? "Running…" : "Run AI"}
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
                  <Send size={15} /> {busy === t.id + "reply" ? "Sending…" : t.reply ? "Update reply" : "Send reply"}
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
                    onClick={() => {
                      if (!confirm(`Mark "${t.subject}" as resolved?`)) return;
                      act(t.id, { action: "status", status: "resolved" }, "Resolved.");
                    }}
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
      )}
    </>
  );
}
