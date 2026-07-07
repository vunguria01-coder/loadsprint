"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/components/toast";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  status: "new" | "answered" | "resolved";
  reply: string | null;
  repliedAt: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Received", cls: "sup-st-new" },
  answered: { label: "Answered", cls: "sup-st-ans" },
  resolved: { label: "Resolved", cls: "sup-st-res" },
};

export function SupportForm() {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  async function load() {
    try {
      const r = await fetch("/api/support");
      const d = await r.json();
      if (d.ok) setTickets(d.tickets);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast("Add details", "Enter a subject and a message.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        toast("Couldn't send", d.error || "Try again.");
      } else {
        toast("Message sent", "We got it — we'll get back to you here.");
        setSubject("");
        setMessage("");
        load();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="sup-form">
        <div className="field full">
          <label>Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Rate con didn't import all stops"
            maxLength={140}
          />
        </div>
        <div className="field full">
          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Describe what happened, what you expected, and the load or driver involved."
            maxLength={4000}
          />
        </div>
        <button className="btn btn-primary" disabled={busy} style={{ alignSelf: "flex-start" }}>
          <Send size={16} /> {busy ? "Sending…" : "Send to support"}
        </button>
      </form>

      {tickets.length > 0 && (
        <div className="sup-history">
          <h3 style={{ margin: "26px 0 12px" }}>Your messages</h3>
          {tickets.map((t) => {
            const st = STATUS[t.status] || STATUS.new;
            return (
              <div key={t.id} className="sup-item">
                <div className="sup-item-top">
                  <b>{t.subject}</b>
                  <span className={`sup-badge ${st.cls}`}>{st.label}</span>
                </div>
                <div className="sup-msg">{t.message}</div>
                <div className="sup-when">{new Date(t.createdAt).toLocaleString()}</div>
                {t.reply && (
                  <div className="sup-reply">
                    <div className="sup-reply-tag">Support replied</div>
                    <div>{t.reply}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
