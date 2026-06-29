"use client";

// Loads jsPDF from a CDN at runtime so we don't add a build dependency.
let pending: Promise<unknown> | null = null;

type JsPDFCtor = new (opts?: Record<string, unknown>) => JsPDFDoc;

export type JsPDFDoc = {
  setFont: (font: string, style?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  text: (text: string | string[], x: number, y: number, opts?: Record<string, unknown>) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  addImage: (
    data: string,
    fmt: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
  addPage: () => void;
  save: (filename: string) => void;
  output: (type: string) => string;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
};

export function loadJsPDF(): Promise<JsPDFCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("client only"));
  const w = window as unknown as { jspdf?: { jsPDF: JsPDFCtor } };
  if (w.jspdf?.jsPDF) return Promise.resolve(w.jspdf.jsPDF);
  if (pending) return pending as Promise<JsPDFCtor>;
  pending = new Promise<JsPDFCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.async = true;
    s.onload = () => {
      const win = window as unknown as { jspdf?: { jsPDF: JsPDFCtor } };
      if (win.jspdf?.jsPDF) resolve(win.jspdf.jsPDF);
      else reject(new Error("PDF library failed to initialize"));
    };
    s.onerror = () => reject(new Error("Failed to load PDF library"));
    document.head.appendChild(s);
  });
  return pending as Promise<JsPDFCtor>;
}
