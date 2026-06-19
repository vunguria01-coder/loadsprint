"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import { useToast } from "@/components/toast";

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
    };
  }
}
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  }>;
};

const PDF_VER = "3.11.174";
function loadPdfJs(): Promise<NonNullable<Window["pdfjsLib"]>> {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VER}/pdf.min.js`;
    s.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) return reject(new Error("pdf.js failed"));
      lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VER}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => reject(new Error("Could not load PDF reader"));
    document.body.appendChild(s);
  });
}

async function extractText(file: File): Promise<string> {
  const lib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str || "").join(" ") + "\n";
  }
  return text;
}

function guessFields(text: string) {
  const out: { ref?: string; origin?: string; dest?: string; rate?: number } = {};
  const ref = text.match(/(?:load|order|ref(?:erence)?|pro)\s*#?\s*[:.]?\s*([A-Z0-9][A-Z0-9-]{3,})/i);
  if (ref) out.ref = ref[1];
  const cityState = "([A-Za-z .'-]+,\\s*[A-Z]{2})";
  const o = text.match(new RegExp(`(?:pickup|pick\\s*up|origin|shipper)[\\s\\S]{0,60}?${cityState}`, "i"));
  if (o) out.origin = o[1].trim();
  const d = text.match(new RegExp(`(?:deliver|delivery|destination|consignee|receiver)[\\s\\S]{0,60}?${cityState}`, "i"));
  if (d) out.dest = d[1].trim();

  // Rate: prefer a $ amount labelled total/rate/amount; else the largest $ amount.
  const money = (s: string) => Number(s.replace(/[,$\s]/g, ""));
  const labelled = text.match(
    /(?:total\s*(?:rate|amount|pay)?|rate\s*(?:con|amount)?|line\s*haul|agreed\s*amount|carrier\s*pay)\D{0,20}\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i
  );
  if (labelled) {
    out.rate = money(labelled[1]);
  } else {
    const all = [...text.matchAll(/\$\s*([0-9][0-9,]{2,}(?:\.[0-9]{2})?)/g)].map((m) => money(m[1]));
    if (all.length) out.rate = Math.max(...all);
  }
  return out;
}

export function CreateLoad({
  driverName,
  driverEmail,
}: {
  driverName: string;
  driverEmail: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [ref, setRef] = useState("");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [brokerName, setBrokerName] = useState("");
  const [brokerEmail, setBrokerEmail] = useState("");
  const [brokerPhone, setBrokerPhone] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  async function onConfirmation(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    try {
      const text = await extractText(file);
      const g = guessFields(text);
      if (g.ref) setRef(g.ref);
      if (g.origin) setOrigin(g.origin);
      if (g.dest) setDest(g.dest);
      if (g.rate) setRate(String(g.rate));
      if (g.ref || g.origin || g.dest || g.rate)
        toast("Imported", "Check the fields and adjust if needed.");
      else toast("Nothing found", "Couldn't read fields — enter them manually.");
    } catch {
      toast("Couldn't read PDF", "Enter the details manually.");
    } finally {
      setReading(false);
    }
  }

  async function create() {
    if (!origin.trim() || !dest.trim()) {
      toast("Missing info", "Enter origin and destination.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref, originName: origin, destName: dest,
          driverName, driverEmail, brokerName, brokerEmail, brokerPhone,
          rate: Number(rate) > 0 ? Number(rate) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Could not create", data.error || "Try again.");
      else {
        toast("Load created", `${data.load.ref} assigned to ${driverName}.`);
        router.push(`/loads/${data.load.id}`);
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <Plus /> New load for {driverName}
      </h3>

      <label className="btn btn-ghost btn-block" style={{ marginBottom: 14, cursor: "pointer" }}>
        <FileUp size={16} /> {reading ? "Reading PDF…" : "Import from rate confirmation (PDF)"}
        <input type="file" accept="application/pdf" hidden onChange={onConfirmation} disabled={reading} />
      </label>

      <div className="fgrid">
        <div className="field full">
          <label>Reference # (optional — auto if blank)</label>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="LS-48217" />
        </div>
        <div className="field">
          <label>Load price ($) — from confirmation</label>
          <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="2000" />
        </div>
        <div className="field">
          <label>Origin (City, ST)</label>
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Dallas, TX" />
        </div>
        <div className="field">
          <label>Destination (City, ST)</label>
          <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Atlanta, GA" />
        </div>
        <div className="field full">
          <label>Broker name (optional)</label>
          <input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="Broker / company" />
        </div>
        <div className="field">
          <label>Broker email (optional)</label>
          <input value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} placeholder="broker@email.com" />
        </div>
        <div className="field">
          <label>Broker phone (optional)</label>
          <input value={brokerPhone} onChange={(e) => setBrokerPhone(e.target.value)} placeholder="(555) 000-0000" />
        </div>
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create load"}
      </button>
    </div>
  );
}
