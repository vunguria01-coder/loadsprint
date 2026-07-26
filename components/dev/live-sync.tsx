"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, RefreshCw, X, ChevronUp, AlertTriangle } from "lucide-react";

// Dev-only live sync overlay. Fast Refresh already swaps client modules in
// place; this adds the two things it doesn't give you:
//   1. visibility — a live feed of exactly which files changed and when;
//   2. coverage — files outside the module graph (data/, public/, config) that
//      Fast Refresh ignores, refreshed here without a manual reload.
// Rendered only when NODE_ENV !== production (see app/layout.tsx).

type Scope = "hot" | "data" | "asset" | "config";

type LiveEvent = {
  id: number;
  path: string;
  kind: "add" | "change" | "delete";
  scope: Scope;
  at: number;
};

type Status = "connecting" | "live" | "offline";

const FEED_LIMIT = 60;
const REFRESH_DEBOUNCE_MS = 180;
const BOOT_KEY = "ls-live-boot";
const COLLAPSED_KEY = "ls-live-collapsed";
const AUTO_KEY = "ls-live-auto";

const SCOPE_LABEL: Record<Scope, string> = {
  hot: "hot",
  data: "data",
  asset: "asset",
  config: "config",
};

function shortTime(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/** Re-point <img>/<link>/<source> at a changed public/ file without a reload. */
function bustAsset(rel: string) {
  const url = rel.replace(/^public/, "");
  const stamp = `ls_live=${Date.now()}`;
  const nodes = document.querySelectorAll<HTMLElement>("img[src], link[href], source[src]");
  nodes.forEach((node) => {
    const attr = node.tagName === "LINK" ? "href" : "src";
    const value = node.getAttribute(attr);
    if (!value || !value.split("?")[0].endsWith(url)) return;
    node.setAttribute(attr, `${value.split("?")[0]}?${stamp}`);
  });
}

export function DevLiveSync() {
  const router = useRouter();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [collapsed, setCollapsed] = useState(true);
  const [auto, setAuto] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [pulse, setPulse] = useState(0);

  const autoRef = useRef(auto);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  autoRef.current = auto;

  // Restore preferences before the first paint of the panel.
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) !== "0");
    setAuto(localStorage.getItem(AUTO_KEY) !== "0");
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    const source = new EventSource("/api/dev/live");

    source.addEventListener("open", () => setStatus("live"));

    source.addEventListener("hello", (e) => {
      setStatus("live");
      const { bootId } = JSON.parse((e as MessageEvent).data) as { bootId: string };
      const seen = sessionStorage.getItem(BOOT_KEY);
      sessionStorage.setItem(BOOT_KEY, bootId);
      // A different bootId means the dev server restarted under us (config edit,
      // crash, manual restart) — the page is stale in ways HMR can't patch.
      if (seen && seen !== bootId) location.reload();
    });

    source.addEventListener("change", (e) => {
      const { events: batch, dropped } = JSON.parse((e as MessageEvent).data) as {
        events: LiveEvent[];
        dropped: number;
      };
      if (!batch.length) return;

      setEvents((prev) => [...batch].reverse().concat(prev).slice(0, FEED_LIMIT));
      setPulse((n) => n + 1);

      let needsRefresh = false;
      for (const ev of batch) {
        if (ev.scope === "config") setRestarting(true);
        else if (ev.scope === "asset") bustAsset(ev.path);
        else if (ev.scope === "data") needsRefresh = true;
        // "hot" is Fast Refresh's job — re-refreshing it only duplicates work.
      }
      // A bulk change (branch switch, mass format) outran the batch cap; the
      // safe read is that anything could have changed.
      if (dropped > 0) needsRefresh = true;
      if (needsRefresh && autoRef.current) scheduleRefresh();
    });

    source.addEventListener("error", () => {
      setStatus(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    });

    return () => {
      source.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh]);

  // Alt+L toggles the panel, so it never has to be in the way.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== "l") return;
      e.preventDefault();
      setCollapsed((c) => {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
        return !c;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });

  const toggleAuto = () =>
    setAuto((a) => {
      localStorage.setItem(AUTO_KEY, a ? "0" : "1");
      return !a;
    });

  const last = events[0];

  return (
    <>
      {/* Top hairline flashes on every applied batch — peripheral, not noisy. */}
      <div key={pulse} className={`ls-pulse${pulse ? " on" : ""}`} aria-hidden />

      <div className={`ls-live${collapsed ? " collapsed" : ""}`}>
        <button className="ls-bar" onClick={toggleCollapsed} title="Alt+L">
          <span className={`ls-dot ${status}`} />
          <Radio size={13} />
          <span className="ls-title">Live sync</span>
          {collapsed && last && <span className="ls-last">{last.path}</span>}
          {collapsed && events.length > 0 && <span className="ls-count">{events.length}</span>}
          <ChevronUp size={14} className="ls-chev" />
        </button>

        {!collapsed && (
          <div className="ls-body">
            {restarting && (
              <div className="ls-warn">
                <AlertTriangle size={13} />
                Config changed — dev server is restarting, the page reloads on its own.
              </div>
            )}

            <div className="ls-feed">
              {events.length === 0 ? (
                <p className="ls-empty">
                  Watching app, components, lib, data, public. Edit a file to see it here.
                </p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="ls-row">
                    <span className="ls-time">{shortTime(ev.at)}</span>
                    <span className={`ls-scope ${ev.scope}`}>{SCOPE_LABEL[ev.scope]}</span>
                    <span className={`ls-path ${ev.kind}`}>{ev.path}</span>
                  </div>
                ))
              )}
            </div>

            <div className="ls-foot">
              <label className="ls-toggle">
                <input type="checkbox" checked={auto} onChange={toggleAuto} />
                Auto-refresh
              </label>
              <button className="ls-btn" onClick={() => router.refresh()}>
                <RefreshCw size={12} /> Refresh
              </button>
              <button className="ls-btn" onClick={() => location.reload()}>
                Hard reload
              </button>
              <button className="ls-btn ls-icon" onClick={toggleCollapsed} aria-label="Collapse">
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .ls-pulse {
          position: fixed;
          top: 0;
          left: 0;
          height: 2px;
          width: 100%;
          z-index: 2147483000;
          background: linear-gradient(90deg, #22d3ee, #2563eb, #22d3ee);
          transform: scaleX(0);
          transform-origin: left;
          pointer-events: none;
          opacity: 0;
        }
        .ls-pulse.on {
          animation: ls-sweep 0.55s ease-out forwards;
        }
        @keyframes ls-sweep {
          0% {
            transform: scaleX(0);
            opacity: 1;
          }
          70% {
            transform: scaleX(1);
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            opacity: 0;
          }
        }

        .ls-live {
          position: fixed;
          left: 16px;
          bottom: 16px;
          z-index: 2147483000;
          width: min(420px, calc(100vw - 32px));
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          color: #e2e8f0;
          background: rgba(15, 23, 42, 0.94);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          box-shadow: 0 12px 30px rgba(2, 6, 23, 0.45);
          backdrop-filter: blur(6px);
          overflow: hidden;
        }
        .ls-live.collapsed {
          width: auto;
          max-width: min(420px, calc(100vw - 32px));
        }

        .ls-bar {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          padding: 7px 10px;
          background: none;
          border: none;
          color: inherit;
          font: inherit;
          cursor: pointer;
          text-align: left;
        }
        .ls-title {
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .ls-last {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #94a3b8;
          direction: rtl;
        }
        .ls-count {
          padding: 1px 6px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.3);
          color: #bfdbfe;
        }
        .ls-chev {
          margin-left: auto;
          opacity: 0.5;
          transition: transform 0.15s ease;
        }
        .collapsed .ls-chev {
          transform: rotate(180deg);
        }

        .ls-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: none;
        }
        .ls-dot.live {
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e;
        }
        .ls-dot.connecting {
          background: #f59e0b;
          animation: ls-blink 1s infinite;
        }
        .ls-dot.offline {
          background: #ef4444;
        }
        @keyframes ls-blink {
          50% {
            opacity: 0.25;
          }
        }

        .ls-body {
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }
        .ls-warn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
        }
        .ls-feed {
          max-height: 210px;
          overflow-y: auto;
          padding: 4px 0;
        }
        .ls-empty {
          margin: 0;
          padding: 10px;
          color: #64748b;
          line-height: 1.5;
        }
        .ls-row {
          display: flex;
          align-items: baseline;
          gap: 7px;
          padding: 2px 10px;
        }
        .ls-row:hover {
          background: rgba(148, 163, 184, 0.08);
        }
        .ls-time {
          color: #64748b;
          flex: none;
        }
        .ls-scope {
          flex: none;
          width: 44px;
          text-align: center;
          border-radius: 3px;
          padding: 0 3px;
          font-size: 10px;
          background: rgba(148, 163, 184, 0.18);
          color: #cbd5e1;
        }
        .ls-scope.hot {
          background: rgba(34, 197, 94, 0.18);
          color: #86efac;
        }
        .ls-scope.data {
          background: rgba(59, 130, 246, 0.2);
          color: #bfdbfe;
        }
        .ls-scope.asset {
          background: rgba(168, 85, 247, 0.2);
          color: #e9d5ff;
        }
        .ls-scope.config {
          background: rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }
        .ls-path {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ls-path.add {
          color: #86efac;
        }
        .ls-path.delete {
          color: #fca5a5;
          text-decoration: line-through;
        }

        .ls-foot {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }
        .ls-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-right: auto;
          color: #94a3b8;
          cursor: pointer;
        }
        .ls-toggle input {
          accent-color: #2563eb;
          cursor: pointer;
        }
        .ls-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 5px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(148, 163, 184, 0.1);
          color: #e2e8f0;
          font: inherit;
          cursor: pointer;
        }
        .ls-btn:hover {
          background: rgba(148, 163, 184, 0.22);
        }
        .ls-icon {
          padding: 3px 5px;
        }
      `}</style>
    </>
  );
}

export default DevLiveSync;
