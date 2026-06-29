"use client";

import { Check, ListChecks } from "lucide-react";
import type { LoadView } from "@/lib/load-view";

const STATUSES = [
  "Assigned",
  "Picked Up",
  "In Transit",
  "At Delivery",
  "Delivered",
  "Closed",
] as const;

export function LoadStatusPanel({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const canEdit = load.youRole !== "broker";
  const isDispatcher = load.youRole === "dispatcher";
  const currentIndex = STATUSES.indexOf(load.status as (typeof STATUSES)[number]);

  // A dispatcher (owner or team) can't mark a load "Delivered" — only the
  // assigned driver can, and with a proof-of-delivery photo. But the owner,
  // dispatcher and driver can all "Close" a load directly at any stage.
  function canSet(s: (typeof STATUSES)[number]): boolean {
    if (!canEdit) return false;
    if (isDispatcher && s === "Delivered") return false;
    return true;
  }

  return (
    <div className="panel">
      <h3>
        <ListChecks /> Status
      </h3>
      <p className="px">
        {!canEdit
          ? "Live delivery progress for this load."
          : isDispatcher
          ? "Tap a stage to update. Only the assigned driver can mark a load Delivered."
          : "Tap a stage to update. Changes appear instantly for the broker."}
      </p>
      <div className="steps-v">
        {STATUSES.map((s, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          const allowed = canSet(s);
          return (
            <button
              key={s}
              className={`sv${done ? " done" : ""}${active ? " active" : ""}`}
              disabled={!allowed}
              style={{ cursor: allowed ? "pointer" : "default", opacity: allowed || done ? 1 : 0.5 }}
              onClick={() => allowed && mutate({ action: "status", status: s })}
            >
              <span className="dot">{done && <Check strokeWidth={3} />}</span>
              <span className="sl">{s}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
