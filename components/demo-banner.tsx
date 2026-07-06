"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useToast } from "@/components/toast";

// Shown while a dispatcher's account still contains sample data. One click wipes
// all demo records and it never comes back.
export function DemoBanner() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/remove", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast("Couldn't remove", data.error || "Try again.");
      } else {
        toast("Demo data removed", "Your account is now clean.");
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo-banner">
      <span className="demo-ic"><Sparkles size={16} /></span>
      <div className="demo-text">
        <b>You&apos;re looking at sample data.</b> Explore Trucks, Profit, Reminders and loads to see how
        LoadSprint works — then remove it before adding your own.
      </div>
      <button className="demo-remove" onClick={remove} disabled={busy}>
        <X size={15} /> {busy ? "Removing…" : "Remove demo data"}
      </button>
    </div>
  );
}
