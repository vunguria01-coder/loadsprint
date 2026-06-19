"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { StatusChip } from "@/components/status-chip";
import { LoadMap } from "@/components/load-map";
import { LoadChat } from "@/components/load-chat";
import { LoadStatusPanel } from "@/components/load-status";
import { LoadDocuments } from "@/components/load-documents";
import { LoadPhotos } from "@/components/load-photos";
import { LoadBroker } from "@/components/load-broker";
import { LoadInvoices } from "@/components/load-invoices";
import { PhotosToPdf } from "@/components/photos-to-pdf";

export function LoadWorkspace({ loadId }: { loadId: string }) {
  const [load, setLoad] = useState<LoadView | null>(null);
  const readSent = useRef(false);

  const fetchLoad = useCallback(
    async (advance: boolean) => {
      try {
        const res = await fetch(
          `/api/loads/${loadId}${advance ? "?advance=1" : ""}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.ok) setLoad(data.load);
      } catch {
        /* ignore */
      }
    },
    [loadId]
  );

  const mutate = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/loads/${loadId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.ok) setLoad(data.load);
      } catch {
        /* ignore */
      }
    },
    [loadId]
  );

  useEffect(() => {
    fetchLoad(false);
    const t = setInterval(() => fetchLoad(true), 4000);
    return () => clearInterval(t);
  }, [fetchLoad]);

  // mark chat read once after first load
  useEffect(() => {
    if (load && !readSent.current) {
      readSent.current = true;
      mutate({ action: "read" });
    }
  }, [load, mutate]);

  if (!load) {
    return (
      <div className="wrap" style={{ padding: "60px 0", color: "var(--muted)" }}>
        Loading load…
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="ld-head">
        <div>
          <div className="ref">{load.ref}</div>
          <div className="route">
            {load.originName} <ArrowRight size={15} /> {load.destName}
          </div>
        </div>
        <StatusChip status={load.status} />
      </div>

      <div className="ld-grid">
        <div>
          <LoadMap load={load} mutate={mutate} />
          <LoadChat load={load} mutate={mutate} />
        </div>
        <div>
          <LoadStatusPanel load={load} mutate={mutate} />
          {(load.youRole === "dispatcher" || load.youRole === "admin") && (
            <LoadBroker load={load} mutate={mutate} />
          )}
          <LoadInvoices load={load} mutate={mutate} />
          <LoadDocuments load={load} mutate={mutate} />
          <LoadPhotos load={load} mutate={mutate} />
          <PhotosToPdf load={load} mutate={mutate} />
        </div>
      </div>
    </div>
  );
}
