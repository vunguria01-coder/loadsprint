"use client";

import { useState } from "react";
import { Share2, Copy, Check, Send } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { useToast } from "@/components/toast";

export function LoadBrokerShare({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = load.shareToken ? `${origin}/b/${load.shareToken}` : "";
  const photos = load.photos || [];

  async function createLink() {
    setBusy(true);
    try {
      await mutate({ action: "broker_share" });
      toast("Broker link ready", "Send the link and code to your broker.");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast("Copied", `${label} copied to clipboard.`),
      () => {}
    );
  }

  async function togglePhoto(photoId: string, visible: boolean) {
    await mutate({ action: "broker_photo", photoId, visible });
  }

  async function publish() {
    setBusy(true);
    try {
      await mutate({ action: "broker_publish" });
      toast("Sent to broker", "Final documents are now visible on the broker link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <Share2 /> Broker portal
      </h3>

      {!load.shareToken ? (
        <>
          <p className="px">
            Create a private link your broker can open with a code to track this
            load — location, status, the rate confirmation, and the photos you choose.
          </p>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={createLink} disabled={busy}>
            {busy ? "Creating…" : "Create broker link"}
          </button>
        </>
      ) : (
        <>
          <p className="px">Send both the link and the code to your broker.</p>

          <div className="bshare-row">
            <span className="bshare-label">Link</span>
            <code className="bshare-val">{link}</code>
            <button className="bshare-copy" onClick={() => copy(link, "Link")} title="Copy link">
              <Copy size={15} />
            </button>
          </div>
          <div className="bshare-row">
            <span className="bshare-label">Code</span>
            <code className="bshare-val bshare-code">{load.shareCode}</code>
            <button className="bshare-copy" onClick={() => copy(load.shareCode || "", "Code")} title="Copy code">
              <Copy size={15} />
            </button>
          </div>

          {/* Choose which photos the broker can see */}
          <div className="bshare-photos">
            <div className="bshare-sub">Photos visible to broker</div>
            {photos.length === 0 ? (
              <p className="px">No photos yet. Photos the driver takes will appear here to choose from.</p>
            ) : (
              <div className="bshare-photo-grid">
                {photos.map((p) => (
                  <label key={p.id} className={`bshare-photo${p.brokerVisible ? " on" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.dataUrl} alt={p.caption || "Load photo"} />
                    <input
                      type="checkbox"
                      checked={!!p.brokerVisible}
                      onChange={(e) => togglePhoto(p.id, e.target.checked)}
                    />
                    <span className="bshare-check">{p.brokerVisible ? <Check size={14} /> : null}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Release final docs */}
          <div className="bshare-publish">
            {load.brokerPublished ? (
              <div className="bshare-sent"><Check size={16} /> Final documents sent to broker</div>
            ) : (
              <button className="btn btn-primary btn-block" onClick={publish} disabled={busy}>
                <Send size={16} /> {busy ? "Sending…" : "Send final documents to broker"}
              </button>
            )}
            <p className="px" style={{ marginTop: 8 }}>
              The broker always sees status, location, the rate confirmation, and the
              photos you picked. “Send” also releases the invoice and any other
              documents on this load.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
