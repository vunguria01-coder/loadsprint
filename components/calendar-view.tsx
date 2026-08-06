"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useToast } from "@/components/toast";

export type CalLoad = {
  id: string;
  ref: string;
  route: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  active: boolean;
};

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_EVENTS_PER_CELL = 3;

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ScheduleRow({ load }: { load: CalLoad }) {
  const router = useRouter();
  const toast = useToast();
  const [pickup, setPickup] = useState(load.pickupDate || "");
  const [delivery, setDelivery] = useState(load.deliveryDate || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/load-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: load.id, pickupDate: pickup, deliveryDate: delivery }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Could not save", data.error || "Try again.");
      else {
        toast("Scheduled", "Load dates updated.");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cal-srow">
      <div className="cal-sinfo">
        <Link href={`/loads/${load.id}`} className="cal-sref">{load.ref}</Link>
        <span className="cal-sroute">{load.route}</span>
      </div>
      <div className="cal-sdate">
        <label>Pickup</label>
        <input type="date" value={pickup} onChange={(e) => setPickup(e.target.value)} />
      </div>
      <div className="cal-sdate">
        <label>Delivery</label>
        <input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={save} disabled={saving}>
        <Save size={14} /> {saving ? "…" : "Save"}
      </button>
    </div>
  );
}

export function CalendarView({ loads }: { loads: CalLoad[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = new Date();
  const [cur, setCur] = useState(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(searchParams.get("month") || "");
    if (m) return { y: Number(m[1]), m: Number(m[2]) - 1 };
    return { y: today.getFullYear(), m: today.getMonth() };
  });

  useEffect(() => {
    const monthParam = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}`;
    const isCurrentMonth = cur.y === today.getFullYear() && cur.m === today.getMonth();
    const qs = isCurrentMonth ? "" : `?month=${monthParam}`;
    router.replace(`${pathname}${qs}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  // Map date string -> events ({ load, type })
  const events = useMemo(() => {
    const map = new Map<string, { load: CalLoad; type: "pickup" | "delivery" }[]>();
    for (const l of loads) {
      if (l.pickupDate) {
        const arr = map.get(l.pickupDate) || [];
        arr.push({ load: l, type: "pickup" });
        map.set(l.pickupDate, arr);
      }
      if (l.deliveryDate) {
        const arr = map.get(l.deliveryDate) || [];
        arr.push({ load: l, type: "delivery" });
        map.set(l.deliveryDate, arr);
      }
    }
    return map;
  }, [loads]);

  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const firstWeekday = new Date(cur.y, cur.m, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(cur.y, cur.m, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  function prev() {
    setCur((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  }
  function next() {
    setCur((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
  }
  function goToday() {
    setCur({ y: today.getFullYear(), m: today.getMonth() });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") prev();
      else next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [openDay, setOpenDay] = useState<string | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const dayPopRef = useRef<HTMLDivElement>(null);

  function closeDayPopover() {
    setOpenDay(null);
    moreButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!openDay) return;
    dayPopRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDayPopover();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dayPopRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
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
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDay]);

  const [hiddenTypes, setHiddenTypes] = useState<Set<"pickup" | "delivery">>(new Set());

  function toggleType(type: "pickup" | "delivery") {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const toSchedule = loads.filter((l) => l.active);

  return (
    <div className="cal-wrap">
      <div className="cal-bar">
        <div className="cal-month" aria-live="polite">{monthLabel}</div>
        <div className="cal-nav">
          <button type="button" onClick={prev} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button type="button" className="cal-today" onClick={goToday}>Today</button>
          <button type="button" onClick={next} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="cal-legend">
        <button
          type="button"
          className={`cal-legend-toggle${hiddenTypes.has("pickup") ? " off" : ""}`}
          onClick={() => toggleType("pickup")}
          aria-pressed={!hiddenTypes.has("pickup")}
        >
          <i className="ev-dot ev-pick-dot" /> Pickup
        </button>
        <button
          type="button"
          className={`cal-legend-toggle${hiddenTypes.has("delivery") ? " off" : ""}`}
          onClick={() => toggleType("delivery")}
          aria-pressed={!hiddenTypes.has("delivery")}
        >
          <i className="ev-dot ev-drop-dot" /> Delivery
        </button>
      </div>

      <div className="cal-grid">
        {WEEK.map((w) => (
          <div className="cal-wd" key={w}>{w}</div>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <div className="cal-cell cal-empty" key={`e${idx}`} />;
          const ds = ymd(cur.y, cur.m, d);
          const evs = (events.get(ds) || []).filter((e) => !hiddenTypes.has(e.type));
          return (
            <div
              className={`cal-cell${ds === todayStr ? " cal-now" : ""}${openDay === ds ? " cal-cell-open" : ""}`}
              aria-current={ds === todayStr ? "date" : undefined}
              key={ds}
            >
              <div className="cal-dnum">{d}</div>
              <div className="cal-evs">
                {evs.slice(0, MAX_EVENTS_PER_CELL).map((e, i) => (
                  <Link
                    key={`${e.load.id}-${e.type}-${i}`}
                    href={`/loads/${e.load.id}`}
                    className={`cal-ev ${e.type === "pickup" ? "ev-pick" : "ev-drop"}`}
                    title={`${e.type === "pickup" ? "Pickup" : "Delivery"}: ${e.load.ref} — ${e.load.route}`}
                  >
                    <span className="ev-dot" />
                    {e.load.ref}
                  </Link>
                ))}
                {evs.length > MAX_EVENTS_PER_CELL && (
                  <button
                    type="button"
                    className="cal-ev-more"
                    onClick={(e) => {
                      moreButtonRef.current = e.currentTarget;
                      setOpenDay(ds);
                    }}
                  >
                    +{evs.length - MAX_EVENTS_PER_CELL} more
                  </button>
                )}
              </div>
              {openDay === ds && (
                <>
                  <div className="cab-acc-scrim" onClick={closeDayPopover} />
                  <div
                    ref={dayPopRef}
                    className="cal-day-pop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`cal-day-pop-title-${ds}`}
                  >
                    <div className="cal-day-pop-head">
                      <b id={`cal-day-pop-title-${ds}`}>{new Date(cur.y, cur.m, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>
                      <button type="button" onClick={closeDayPopover} aria-label="Close">✕</button>
                    </div>
                    <div className="cal-day-pop-list">
                      {evs.map((e, i) => (
                        <Link
                          key={`${e.load.id}-${e.type}-${i}`}
                          href={`/loads/${e.load.id}`}
                          className={`cal-ev ${e.type === "pickup" ? "ev-pick" : "ev-drop"}`}
                          title={`${e.type === "pickup" ? "Pickup" : "Delivery"}: ${e.load.ref} — ${e.load.route}`}
                        >
                          <span className="ev-dot" />
                          {e.load.ref}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="cal-sched">
        <h3>Schedule loads</h3>
        <p className="ins-sub">Set pickup and delivery dates for your active loads — they appear on the calendar above.</p>
        {toSchedule.length === 0 ? (
          <p className="px">No active loads to schedule.</p>
        ) : (
          <div className="cal-slist">
            {toSchedule.map((l) => (
              <ScheduleRow key={l.id} load={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
