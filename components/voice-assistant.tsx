"use client";

// Floating voice assistant, available on every page. Speech recognition and
// speech synthesis run in the browser (Web Speech API) — free, no keys. The
// "brain" is /api/assistant, which uses the site's existing Anthropic key.
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Mic, X, Send, Loader2, Volume2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

// Cyrillic → speak/listen in Russian, otherwise English.
function langFor(text: string): "ru-RU" | "en-US" {
  return /[Ѐ-ӿ]/.test(text) ? "ru-RU" : "en-US";
}

export function VoiceAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [supportsVoice, setSupportsVoice] = useState(true);
  const recognitionRef = useRef<any>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Only show for signed-in users.
  useEffect(() => {
    let alive = true;
    fetch("/api/assistant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.ok) setEnabled(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) setSupportsVoice(false);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, thinking]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langFor(text);
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || thinking) return;
      const history = messages.slice(-8);
      setMessages((m) => [...m, { role: "user", text: clean }]);
      setThinking(true);
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: clean, history, path: pathname }),
        });
        const data = await res.json().catch(() => ({}));
        const reply =
          data?.text ||
          (langFor(clean) === "ru-RU"
            ? "Извините, не получилось."
            : "Sorry, something went wrong.");
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
        speak(reply);
        if (data?.action?.type === "navigate" && data.action.href) {
          setTimeout(() => router.push(data.action.href), 400);
        }
      } catch {
        const reply =
          langFor(clean) === "ru-RU" ? "Ошибка соединения." : "Connection error.";
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
      } finally {
        setThinking(false);
      }
    },
    [messages, pathname, router, speak, thinking]
  );

  const startListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupportsVoice(false);
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      const rec = new SR();
      rec.lang = "ru-RU";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setListening(true);
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || "";
        if (transcript) send(transcript);
      };
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setListening(false);
    }
  }, [send]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <button
        className="va-fab"
        aria-label="Assistant"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} /> : <Mic size={22} />}
      </button>

      {open && (
        <div className="va-panel" role="dialog" aria-label="Voice assistant">
          <div className="va-head">
            <Volume2 size={16} />
            <span>Ассистент</span>
            <button className="va-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="va-body" ref={bodyRef}>
            {messages.length === 0 && (
              <div className="va-hint">
                Нажмите микрофон и скажите, например: «покажи мои грузы», «открой
                водителей» или «создай груз из Далласа в Атланту водителю mike@demo.com».
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`va-msg va-${m.role}`}>
                {m.text}
              </div>
            ))}
            {thinking && (
              <div className="va-msg va-assistant va-loading">
                <Loader2 size={15} className="va-spin" /> …
              </div>
            )}
          </div>

          <form
            className="va-input"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft;
              setDraft("");
              send(t);
            }}
          >
            <button
              type="button"
              className={`va-mic${listening ? " on" : ""}`}
              onClick={listening ? stopListening : startListening}
              disabled={!supportsVoice}
              aria-label="Speak"
              title={supportsVoice ? "Говорить" : "Голос не поддерживается в этом браузере"}
            >
              <Mic size={18} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={listening ? "Слушаю…" : "Спросите или скажите…"}
            />
            <button type="submit" className="va-send" aria-label="Send" disabled={!draft.trim()}>
              <Send size={17} />
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        .va-fab {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 1000;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.4);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .va-fab:hover {
          transform: scale(1.06);
        }
        .va-panel {
          position: fixed;
          right: 20px;
          bottom: 88px;
          z-index: 1000;
          width: min(360px, calc(100vw - 32px));
          height: min(520px, calc(100vh - 140px));
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .va-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          font-weight: 600;
          color: #0f172a;
          border-bottom: 1px solid #eef2f7;
        }
        .va-close {
          margin-left: auto;
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          display: flex;
        }
        .va-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .va-hint {
          font-size: 13px;
          line-height: 1.5;
          color: #64748b;
          background: #f8fafc;
          border: 1px solid #eef2f7;
          border-radius: 12px;
          padding: 12px;
        }
        .va-msg {
          max-width: 85%;
          padding: 9px 12px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .va-user {
          align-self: flex-end;
          background: #2563eb;
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .va-assistant {
          align-self: flex-start;
          background: #f1f5f9;
          color: #0f172a;
          border-bottom-left-radius: 4px;
        }
        .va-loading {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .va-spin {
          animation: va-rot 1s linear infinite;
        }
        @keyframes va-rot {
          to {
            transform: rotate(360deg);
          }
        }
        .va-input {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid #eef2f7;
        }
        .va-input input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
        }
        .va-input input:focus {
          border-color: #93c5fd;
        }
        .va-mic,
        .va-send {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .va-mic {
          background: #eff6ff;
          color: #2563eb;
        }
        .va-mic.on {
          background: #ef4444;
          color: #fff;
          animation: va-pulse 1.2s ease-in-out infinite;
        }
        .va-mic:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .va-send {
          background: #2563eb;
          color: #fff;
        }
        .va-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @keyframes va-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        @media (prefers-color-scheme: dark) {
          .va-panel {
            background: #0f172a;
            border-color: #1e293b;
          }
          .va-head {
            color: #e2e8f0;
            border-color: #1e293b;
          }
          .va-hint {
            background: #1e293b;
            border-color: #263449;
            color: #94a3b8;
          }
          .va-assistant {
            background: #1e293b;
            color: #e2e8f0;
          }
          .va-input {
            border-color: #1e293b;
          }
          .va-input input {
            background: #1e293b;
            border-color: #334155;
            color: #e2e8f0;
          }
          .va-mic {
            background: #1e293b;
            color: #60a5fa;
          }
        }
      `}</style>
    </>
  );
}
