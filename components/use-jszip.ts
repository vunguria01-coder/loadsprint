"use client";

// Loads JSZip from a CDN at runtime so we don't add a build dependency
// (same pattern as use-jspdf).

type JsZipFile = {
  file: (name: string, data: string | Blob | ArrayBuffer, opts?: { base64?: boolean }) => void;
  generateAsync: (opts: { type: "blob" }) => Promise<Blob>;
};
type JsZipCtor = new () => JsZipFile;

let pending: Promise<JsZipCtor> | null = null;

export type { JsZipFile };

export function loadJsZip(): Promise<JsZipCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("client only"));
  const w = window as unknown as { JSZip?: JsZipCtor };
  if (w.JSZip) return Promise.resolve(w.JSZip);
  if (pending) return pending;
  pending = new Promise<JsZipCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.async = true;
    s.onload = () => {
      const win = window as unknown as { JSZip?: JsZipCtor };
      if (win.JSZip) resolve(win.JSZip);
      else reject(new Error("ZIP library failed to initialize"));
    };
    s.onerror = () => reject(new Error("Failed to load ZIP library"));
    document.head.appendChild(s);
  });
  return pending;
}
