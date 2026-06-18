"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Paperclip, Send, FileText } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { fileToDataUrl, clockTime } from "@/lib/format";

type Pending = { name: string; dataUrl: string; kind: "image" | "pdf" | "file" };

export function LoadChat({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState<Pending | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [load.messages.length]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const kind: Pending["kind"] = file.type.startsWith("image/")
      ? "image"
      : file.type === "application/pdf"
      ? "pdf"
      : "file";
    setPending({ name: file.name, dataUrl, kind });
  }

  async function send() {
    if (!text.trim() && !pending) return;
    setSending(true);
    try {
      await mutate({
        action: "message",
        text: text.trim(),
        attachments: pending ? [pending] : [],
      });
      setText("");
      setPending(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <MessageSquare /> Load chat
      </h3>
      <p className="px">Dispatcher, driver and broker — scoped to this load only.</p>

      <div className="chat">
        <div className="chat-stream" ref={streamRef}>
          {load.messages.map((m) => {
            const mine = m.authorId === load.youId;
            const readByOther = m.readBy.some((id) => id !== m.authorId);
            return (
              <div key={m.id} className={`msg${mine ? " me" : ""}`}>
                {!mine && (
                  <span className="meta">
                    <span className="who">{m.authorName}</span> · {m.authorRole}
                  </span>
                )}
                {m.text && <div className="bubble">{m.text}</div>}
                {m.attachments.length > 0 && (
                  <div className="att">
                    {m.attachments.map((a, i) =>
                      a.kind === "image" ? (
                        <img
                          key={i}
                          src={a.dataUrl}
                          alt={a.name}
                          onClick={() => setOpen(a)}
                        />
                      ) : (
                        <a
                          key={i}
                          href={a.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={a.kind === "file" ? a.name : undefined}
                          onClick={(e) => {
                            if (a.kind === "pdf") {
                              e.preventDefault();
                              setOpen(a);
                            }
                          }}
                        >
                          <FileText size={14} /> {a.name}
                        </a>
                      )
                    )}
                  </div>
                )}
                <span className="meta">
                  {clockTime(m.createdAt)}
                  {mine && (
                    <span className="read">· {readByOther ? "Read" : "Sent"}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {pending && (
          <span className="attach-chip">
            <Paperclip size={12} /> {pending.name}
            <button
              onClick={() => setPending(null)}
              style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </span>
        )}

        <div className="chat-input">
          <label className="clip">
            <Paperclip size={18} />
            <input type="file" accept="image/*,application/pdf" onChange={onFile} />
          </label>
          <input
            type="text"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sending && send()}
          />
          <button className="send" onClick={send} disabled={sending} aria-label="Send">
            <Send size={17} />
          </button>
        </div>
      </div>

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>{open.name}</b>
              <button onClick={() => setOpen(null)}>Close ✕</button>
            </div>
            {open.kind === "pdf" ? (
              <iframe title={open.name} src={open.dataUrl} />
            ) : (
              <img src={open.dataUrl} alt={open.name} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
