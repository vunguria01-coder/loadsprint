"use client";

import { useEffect, useRef, useState } from "react";

const PDF_VER = "3.11.174";

// Lazy-load pdf.js from CDN (browser needs internet).
function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) return resolve(w.pdfjsLib);
    const s = document.createElement("script");
    s.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VER}/pdf.min.js`;
    s.onload = () => {
      const lib = w.pdfjsLib;
      if (!lib) return reject(new Error("pdf.js failed"));
      lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VER}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => reject(new Error("Could not load PDF reader"));
    document.body.appendChild(s);
  });
}

type Span = { text: string; left: number; top: number; width: number; height: number };
type RenderedPage = { width: number; height: number; dataUrl: string; spans: Span[] };

export function PdfPicker({
  dataUrl,
  onOrigin,
  onDestination,
}: {
  dataUrl: string;
  onOrigin: (text: string) => void;
  onDestination: (text: string) => void;
}) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    setPages([]);
    (async () => {
      try {
        const lib = await loadPdfJs();
        const base64 = dataUrl.split(",")[1] || "";
        const bin = atob(base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const pdf = await lib.getDocument({ data: arr }).promise;
        const scale = 1.4;
        const out: RenderedPage[] = [];
        const maxPages = Math.min(pdf.numPages, 3);
        for (let n = 1; n <= maxPages; n++) {
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const content = await page.getTextContent();
          const spans: Span[] = [];
          for (const item of content.items as any[]) {
            const str = (item.str || "").trim();
            if (!str) continue;
            const tx = lib.Util.transform(viewport.transform, item.transform);
            const h = Math.hypot(tx[2], tx[3]) || 12;
            const w = (item.width || 0) * scale;
            spans.push({
              text: str,
              left: tx[4],
              top: tx[5] - h,
              width: w || str.length * h * 0.5,
              height: h,
            });
          }
          out.push({ width: viewport.width, height: viewport.height, dataUrl: canvas.toDataURL("image/jpeg", 0.7), spans });
        }
        if (mounted.current) {
          setPages(out);
          setLoading(false);
        }
      } catch {
        if (mounted.current) {
          setError("Could not display this PDF. You can still type the address.");
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [dataUrl]);

  function addSpan(text: string) {
    setPicked((p) => (p ? `${p} ${text}` : text).replace(/\s{2,}/g, " ").trim());
  }

  if (loading) return <div className="pdfp-status">Rendering PDF…</div>;
  if (error) return <div className="pdfp-status">{error}</div>;

  return (
    <div className="pdfp">
      <div className="pdfp-bar">
        <div className="pdfp-picked">
          {picked ? picked : <span className="pdfp-hint">Click words in the PDF to build an address</span>}
        </div>
        <div className="pdfp-actions">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "6px 11px" }}
            disabled={!picked}
            onClick={() => onOrigin(picked)}
          >
            → Origin
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "6px 11px" }}
            disabled={!picked}
            onClick={() => onDestination(picked)}
          >
            → Destination
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "6px 11px" }}
            disabled={!picked}
            onClick={() => setPicked("")}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="pdfp-pages">
        {pages.map((pg, i) => (
          <div
            key={i}
            className="pdfp-page"
            style={{ width: pg.width, height: pg.height }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pg.dataUrl} alt={`Page ${i + 1}`} width={pg.width} height={pg.height} />
            {pg.spans.map((sp, j) => (
              <button
                key={j}
                type="button"
                className="pdfp-span"
                style={{ left: sp.left, top: sp.top, width: sp.width, height: sp.height }}
                title={sp.text}
                onClick={() => addSpan(sp.text)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
