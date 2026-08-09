"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "loads", label: "Loads" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function DriverCardTabs({
  overview,
  loads,
  documents,
  activity,
}: {
  overview: ReactNode;
  loads: ReactNode;
  documents: ReactNode;
  activity: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const content: Record<TabKey, ReactNode> = { overview, loads, documents, activity };

  return (
    <div>
      <div className="dc-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`dc-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{content[tab]}</div>
    </div>
  );
}
