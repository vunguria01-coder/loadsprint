"use client";

import { FileText, Image as ImageIcon } from "lucide-react";
import { downloadDataUrl, openInTab, DOC_LABELS } from "@/components/load-documents";
import { timeAgo } from "@/lib/format";

const PHOTO_LABELS: Record<string, string> = {
  before_pickup: "Before pickup",
  in_transit: "In transit",
  at_delivery: "At delivery",
};

type DocItem = { id: string; type: string; name: string; dataUrl: string; uploadedAt: string };
type PhotoItem = { id: string; phase: string; dataUrl: string; caption: string; uploadedAt: string };

export type DriverDocGroup = {
  id: string;
  ref: string;
  status: string;
  documents: DocItem[];
  photos: PhotoItem[];
};

export function DriverDocuments({ groups }: { groups: DriverDocGroup[] }) {
  const withFiles = groups.filter((g) => g.documents.length > 0 || g.photos.length > 0);

  if (withFiles.length === 0) {
    return <p className="px">No documents or photos uploaded for this driver's loads yet.</p>;
  }

  return (
    <div>
      {withFiles.map((g) => (
        <div key={g.id} className="dc-doc-group">
          <div className="dc-doc-group-head">
            <span className="ref">{g.ref}</span>
            <span className="status-chip">{g.status}</span>
          </div>
          <div className="dc-doc-list">
            {g.documents.map((d) => (
              <div key={d.id} className="dc-doc-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={16} />
                  <div>
                    <div className="name">{DOC_LABELS[d.type] || d.name}</div>
                    <div className="meta">{timeAgo(d.uploadedAt)}</div>
                  </div>
                </div>
                <div className="btns">
                  <button type="button" onClick={() => openInTab(d.dataUrl)}>View</button>
                  <button type="button" onClick={() => downloadDataUrl(d.dataUrl, d.name)}>Download</button>
                </div>
              </div>
            ))}
            {g.photos.map((p) => (
              <div key={p.id} className="dc-doc-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ImageIcon size={16} />
                  <div>
                    <div className="name">{p.caption || PHOTO_LABELS[p.phase] || "Photo"}</div>
                    <div className="meta">{timeAgo(p.uploadedAt)}</div>
                  </div>
                </div>
                <div className="btns">
                  <button type="button" onClick={() => openInTab(p.dataUrl)}>View</button>
                  <button type="button" onClick={() => downloadDataUrl(p.dataUrl, p.caption || "photo")}>Download</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
