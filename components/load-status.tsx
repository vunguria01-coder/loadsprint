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
  const currentIndex = STATUSES.indexOf(load.status as (typeof STATUSES)[number]);

  return (
    <div className="panel">
      <h3>
        <ListChecks /> Status
      </h3>
      <p className="px">
        {canEdit
          ? "Tap a stage to update. Changes appear instantly for the broker."
          : "Live delivery progress for this load."}
      </p>
      <div className="steps-v">
        {STATUSES.map((s, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          return (
            <button
              key={s}
              className={`sv${done ? " done" : ""}${active ? " active" : ""}`}
              disabled={!canEdit}
              style={{ cursor: canEdit ? "pointer" : "default" }}
              onClick={() => canEdit && mutate({ action: "status", status: s })}
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
