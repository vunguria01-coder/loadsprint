"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ExternalLink, Download } from "lucide-react";

// A modal PDF viewer. Converts a data: URL to a blob object URL so it renders in
// an <iframe> and opens reliably in a new tab (Chrome blocks new-tab data: URLs).
export function PdfModal({
  title,
  dataUrl,
  fileName = "document.pdf",
  onClose,
}: {
  title: string;
  dataUrl: string;
  fileName?: string;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState("");

  useEffect(() => {
    let url = "";
    try {
      if (dataUrl.startsWith("data:")) {
        const [meta, b64] = dataUrl.split(",");
        const mime = /:(.*?);/.exec(meta)?.[1] || "application/pdf";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      } else {
        url = dataUrl;
      }
    } catch {
      url = dataUrl;
    }
    setBlobUrl(url);
    return () => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [dataUrl]);

  const canDownload = useMemo(() => dataUrl.startsWith("data:"), [dataUrl]);

  return (
    <div className="modal" onClick={onClose}>
      <div className="box pdfm-box" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <b>{title}</b>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {blobUrl && (
              <a className="btn btn-ghost btn-sm" href={blobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Open in new tab
              </a>
            )}
            {canDownload && (
              <a className="btn btn-ghost btn-sm" href={dataUrl} download={fileName}>
                <Download size={14} /> Download
              </a>
            )}
            <button onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div className="pdfm-body">
          {blobUrl ? (
            <iframe title={title} src={blobUrl} className="pdfm-frame" />
          ) : (
            <div className="px" style={{ padding: 24 }}>Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
