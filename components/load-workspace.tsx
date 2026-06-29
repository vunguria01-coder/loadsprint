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
import { PhotosToPdf } from "@/components/photos-to-pdf";
import { LoadInvoiceAi } from "@/components/load-invoice-ai";
import { LoadBrokerShare } from "@/components/load-broker-share";
import { Collapsible } from "@/components/collapsible";

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

  // Current stop = the first stop the driver hasn't completed yet.
  const stopsArr = load.stops || [];
  const currentStopId = stopsArr.find((st) => !st.done)?.id ?? null;
  const doneCount = stopsArr.filter((st) => st.done).length;

  return (
    <div className="wrap">
      <div className="ld-head">
        <div>
          <div className="ref">{load.ref}</div>
          <div className="route">
            {load.originName} <ArrowRight size={15} /> {load.destName}
          </div>
          {load.dispatcherName && (
            <div className="px" style={{ marginTop: 4 }}>
              Added by {load.dispatcherName}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {typeof load.loadRate === "number" && load.loadRate > 0 && (
            <div className="ld-price">
              ${load.loadRate.toLocaleString("en-US")}
            </div>
          )}
          <StatusChip status={load.status} />
        </div>
      </div>

      <div className="ld-grid">
        {load.status === "Closed" ? (
          <>
            <div>
              <Collapsible title="Map & location">
                <LoadMap load={load} mutate={mutate} />
              </Collapsible>
              <Collapsible title="Load chat">
                <LoadChat load={load} mutate={mutate} />
              </Collapsible>
            </div>
            <div>
              {/* Invoice is the focus on a closed load */}
              <LoadInvoiceAi load={load} mutate={mutate} />
              <Collapsible title="Status">
                <LoadStatusPanel load={load} mutate={mutate} />
              </Collapsible>
              {load.stops && load.stops.length > 0 && (
                <Collapsible title={`Stops (${load.stops.length})`}>
                  <div className="panel">
                    <div className="stop-progress">Driver progress: {doneCount} / {load.stops.length} stops done</div>
                    {load.stops.map((st, i) => (
                      <div key={st.id} className={`stop-row${st.done ? " done" : ""}${st.id === currentStopId ? " current" : ""}`}>
                        <span className={`stop-badge ${st.kind}`}>
                          {st.kind === "pickup" ? "PICKUP" : "DROP"}
                        </span>
                        <div className="stop-body">
                          <div className="stop-addr">{i + 1}. {st.address}</div>
                          {st.time && <div className="stop-time">{st.time}</div>}
                        </div>
                        {st.id === currentStopId && <span className="stop-current">● Driver here</span>}
                        {st.done && <span className="stop-check">✓ done</span>}
                      </div>
                    ))}
                  </div>
                </Collapsible>
              )}
              {/* Files and photos stay visible (expanded) */}
              <LoadDocuments load={load} mutate={mutate} />
              <LoadPhotos load={load} mutate={mutate} />
              <PhotosToPdf load={load} mutate={mutate} />
              {(load.youRole === "dispatcher" || load.youRole === "admin") && (
                <LoadBrokerShare load={load} mutate={mutate} />
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <LoadMap load={load} mutate={mutate} />
              <LoadChat load={load} mutate={mutate} />
            </div>
            <div>
              <LoadStatusPanel load={load} mutate={mutate} />
              {load.stops && load.stops.length > 0 && (
                <div className="panel">
                  <h3>Stops ({load.stops.length})</h3>
                  <p className="px">All pickups and drop-offs on this load.</p>
                  <div className="stop-progress">Driver progress: {doneCount} / {load.stops.length} stops done</div>
                  {load.stops.map((st, i) => (
                    <div key={st.id} className={`stop-row${st.done ? " done" : ""}${st.id === currentStopId ? " current" : ""}`}>
                      <span className={`stop-badge ${st.kind}`}>
                        {st.kind === "pickup" ? "PICKUP" : "DROP"}
                      </span>
                      <div className="stop-body">
                        <div className="stop-addr">{i + 1}. {st.address}</div>
                        {st.time && <div className="stop-time">{st.time}</div>}
                      </div>
                      {st.id === currentStopId && <span className="stop-current">● Driver here</span>}
                      {st.done && <span className="stop-check">✓ done</span>}
                    </div>
                  ))}
                </div>
              )}
              <LoadDocuments load={load} mutate={mutate} />
              <LoadPhotos load={load} mutate={mutate} />
              <PhotosToPdf load={load} mutate={mutate} />
              {(load.youRole === "dispatcher" || load.youRole === "admin") && (
                <LoadBrokerShare load={load} mutate={mutate} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
