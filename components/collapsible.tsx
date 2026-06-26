"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Wraps a section so it can be collapsed/expanded. Used on closed loads to fold
// the working sections while keeping them one click away.
export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible${open ? " open" : ""}`}>
      <button type="button" className="collapsible-head" onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={18} className="collapsible-chev" />
        <span>{title}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
