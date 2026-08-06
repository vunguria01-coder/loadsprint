"use client";

import { Copy } from "lucide-react";
import { useToast } from "@/components/toast";

// A small pill that copies its value to the clipboard on click — for
// identifiers (plate, VIN) a dispatcher pastes elsewhere far more often
// than they read character-by-character.
export function CopyChip({ label, value }: { label: string; value: string }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied", `${label} copied to clipboard.`);
    } catch {
      toast("Could not copy", "Your browser blocked clipboard access.");
    }
  }

  return (
    <button type="button" className="copy-chip" onClick={copy} title={`Copy ${label}`}>
      {label} {value} <Copy size={12} />
    </button>
  );
}
