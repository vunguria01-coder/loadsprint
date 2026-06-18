"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { timeAgo } from "@/lib/format";

type Notif = {
  id: string;
  text: string;
  loadRef: string;
  createdAt: string;
  read: boolean;
};

export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
        setUnread(data.unread);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div className="bell" ref={ref}>
      <button className="bbtn" onClick={toggle} aria-label="Notifications">
        <Bell />
        {unread > 0 && <span className="count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="drop">
          <div className="dh">Notifications</div>
          {items.length === 0 ? (
            <div className="nempty">No notifications yet.</div>
          ) : (
            items.slice(0, 30).map((n) => (
              <div key={n.id} className={`ni${n.read ? "" : " unread"}`}>
                <div className="nt">{n.text}</div>
                <div className="nm">
                  {n.loadRef} · {timeAgo(n.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
