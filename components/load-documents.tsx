"use client";

import { useState } from "react";
import { FileText, File as FileIcon } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { fileToDataUrl, timeAgo } from "@/lib/format";

const DOC_LABELS: Record<string, string> = {
  rate_confirmation: "Rate Con",
  bol: "BOL",
  pod: "POD",
  attachment: "Attachment",
  invoice_broker: "Invoice",
  invoice_driver: "Driver invoice",
};

// Download a data-URL document to the device.
function downloadDataUrl(dataUrl: string, name: string) {
  try {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.open(dataUrl, "_blank");
  }
}

// Open a data-URL document in a real browser tab. Phones often refuse to render
// a PDF inside an in-page <iframe>, so this gives a reliable full-screen view.
function openInTab(dataUrl: string) {
  if (dataUrl.startsWith("data:image")) {
    const w = window.open();
    if (w) w.document.write(`<img src="${dataUrl}" style="max-width:100%"/>`);
    return;
  }
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.slice(5, meta.indexOf(";")) || "application/pdf";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    window.open(dataUrl, "_blank");
  }
}

export function LoadDocuments({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [docType, setDocType] = useState("rate_confirmation");
  const [open, setOpen] = useState<{ name: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasteText, setPasteText] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await mutate({ action: "document", docType, name: file.name, dataUrl });
    } finally {
      setBusy(false);
    }
  }

  async function savePastedText() {
    const text = pasteText.trim();
    if (!text) return;
    setBusy(true);
    try {
      const b64 = btoa(unescape(encodeURIComponent(text)));
      const dataUrl = `data:text/plain;base64,${b64}`;
      const labelName =
        docType === "rate_confirmation" ? "Rate Confirmation.txt" : "Document.txt";
      await mutate({ action: "document", docType, name: labelName, dataUrl });
      setPasteText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <FileText /> Documents
      </h3>
      <p className="px">Rate Confirmation, BOL, POD and attachments — open in-app.</p>

      {load.documents.length === 0 && (
        <div className="empty" style={{ padding: 18 }}>
          No documents yet.
        </div>
      )}
      {load.documents.map((d) => (
        <div className="doc-row" key={d.id}>
          <div className="di">
            <FileIcon />
          </div>
          <div>
            <div className="dn">{d.name}</div>
            <div className="dm">
              {d.uploadedByName} · {timeAgo(d.uploadedAt)}
            </div>
          </div>
          <span className="dt">{DOC_LABELS[d.type]}</span>
          <button className="open" onClick={() => setOpen({ name: d.name, dataUrl: d.dataUrl })}>
            Open
          </button>
          {load.youRole !== "broker" && (
            <button
              className="open"
              style={{ background: "rgba(74,222,128,.12)", borderColor: "rgba(74,222,128,.3)", color: "#4ade80" }}
              onClick={() => mutate({ action: "send_doc", docId: d.id })}
            >
              Send to driver
            </button>
          )}
        </div>
      ))}

      <div className="uploader">
        <select value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="rate_confirmation">Rate Con</option>
          <option value="bol">BOL</option>
          <option value="pod">POD</option>
          <option value="attachment">Attachment</option>
        </select>
        <label className="file">
          {busy ? "Uploading…" : "Upload PDF / image"}
          <input type="file" accept="application/pdf,image/*" onChange={onFile} disabled={busy} />
        </label>
      </div>

      {load.youRole !== "broker" && (
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="…or paste Rate Confirmation text copied from another site"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            style={{
              width: "100%",
              minHeight: 80,
              fontFamily: "Inter, sans-serif",
              fontSize: 13.5,
              color: "#fff",
              background: "rgba(8,14,28,.7)",
              border: "1px solid var(--line)",
              borderRadius: 11,
              padding: "11px 13px",
              resize: "vertical",
            }}
          />
          <button
            className="btn btn-ghost"
            style={{ marginTop: 8, padding: "9px 14px" }}
            disabled={!pasteText.trim() || busy}
            onClick={savePastedText}
          >
            Save pasted text as document
          </button>
        </div>
      )}

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>{open.name}</b>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button
                  onClick={() => openInTab(open.dataUrl)}
                  style={{ color: "var(--sky)" }}
                >
                  Open in tab ↗
                </button>
                <button
                  onClick={() => downloadDataUrl(open.dataUrl, open.name)}
                  style={{ color: "var(--sky)" }}
                >
                  Download ⤓
                </button>
                <button onClick={() => setOpen(null)}>Close ✕</button>
              </div>
            </div>
            {open.dataUrl.startsWith("data:image") ? (
              <img src={open.dataUrl} alt={open.name} />
            ) : (
              <iframe title={open.name} src={open.dataUrl} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
