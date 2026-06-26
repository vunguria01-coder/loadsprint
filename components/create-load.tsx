"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import { useToast } from "@/components/toast";
import { PdfPicker } from "@/components/pdf-picker";

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

type Parsed = {
  ref?: string;
  rate?: number;
  pickups: string[];
  deliveries: string[];
  origin?: string;
  dest?: string;
  brokerName?: string;
  brokerEmail?: string;
  brokerPhone?: string;
  mc?: string;
};

function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of arr) {
    const k = a.toLowerCase().replace(/\s+/g, " ").trim();
    if (k && !seen.has(k)) { seen.add(k); out.push(a.trim()); }
  }
  return out;
}

// Careful, multi-pass parse of a rate confirmation's text.
function parseConfirmation(text: string): Parsed {
  const out: Parsed = { pickups: [], deliveries: [] };
  const cityState = /([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})(?:\s+\d{5})?/g;

  // Reference / load number
  const ref = text.match(/(?:load|order|ref(?:erence)?|pro|trip)\s*#?\s*[:.]?\s*([A-Z0-9][A-Z0-9-]{3,})/i);
  if (ref) out.ref = ref[1];

  // MC number
  const mc = text.match(/\bMC\s*#?\s*[:.]?\s*([0-9]{4,8})/i);
  if (mc) out.mc = mc[1];

  // Broker block: name, email, phone
  const bname = text.match(/(?:broker|brokerage|customer|company)\s*(?:name)?\s*[:.]\s*([A-Za-z0-9 .,&'\-]{3,50})/i);
  if (bname) out.brokerName = bname[1].trim().replace(/\s{2,}/g, " ");
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) out.brokerEmail = email[0];
  const phone = text.match(/(?:phone|tel|ph|contact)\s*[:.]?\s*(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i)
    || text.match(/(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  if (phone) out.brokerPhone = phone[1].trim();

  // Rate: prefer labelled total/rate; else largest $ amount
  const m = (s: string) => Number(s.replace(/[,$\s]/g, ""));
  const labelled = text.match(/(?:total\s*(?:rate|amount|pay)?|rate\s*(?:con|amount)?|line\s*haul|agreed\s*amount|carrier\s*(?:pay|rate))\D{0,20}\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i);
  if (labelled) out.rate = m(labelled[1]);
  else {
    const all = [...text.matchAll(/\$\s*([0-9][0-9,]{2,}(?:\.[0-9]{2})?)/g)].map((x) => m(x[1]));
    if (all.length) out.rate = Math.max(...all);
  }

  // Stops: scan around pickup/delivery keywords and capture the fullest address
  // (street + city + state + zip) plus the City, ST used for the map.
  const pickKey = /(pick\s*up|pickup|pick-up|origin|shipper|ship\s*from|p\/u)/gi;
  const dropKey = /(deliver(?:y|ies)?|consignee|receiver|drop|ship\s*to|destination|d\/o)/gi;

  const addrRe =
    /(\d{1,6}\s+[A-Za-z0-9 .,'#/-]{2,45}?[, ]\s*)?([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})(\s*\d{5}(?:-\d{4})?)?/;

  function near(keyword: RegExp): { full: string; city: string }[] {
    const found: { full: string; city: string }[] = [];
    const re = new RegExp(keyword.source, "gi");
    let km: RegExpExecArray | null;
    while ((km = re.exec(text)) !== null) {
      const win = text.slice(km.index, km.index + 170);
      const a = win.match(addrRe);
      if (a) {
        const street = (a[1] || "").trim().replace(/[,\s]+$/, "");
        const city = a[2].trim().replace(/\s{2,}/g, " ");
        const zip = (a[3] || "").trim();
        const full = [street, city + (zip ? " " + zip : "")].filter(Boolean).join(", ");
        found.push({ full, city });
      }
    }
    // de-dupe by city so the same stop isn't counted twice
    const seen = new Set<string>();
    return found.filter((f) => {
      const k = f.city.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const pickArr = near(pickKey);
  const dropArr = near(dropKey);

  // Fallback: if a side is missing, use first/last City, ST in the document
  if (pickArr.length === 0 || dropArr.length === 0) {
    const allCs = uniq([...text.matchAll(cityState)].map((x) => x[1]));
    if (pickArr.length === 0 && allCs[0]) pickArr.push({ full: allCs[0], city: allCs[0] });
    if (dropArr.length === 0 && allCs.length > 1) {
      const last = allCs[allCs.length - 1];
      dropArr.push({ full: last, city: last });
    }
  }

  out.pickups = pickArr.map((a) => a.full);
  out.deliveries = dropArr.map((a) => a.full);
  out.origin = pickArr[0]?.city;
  out.dest = dropArr[dropArr.length - 1]?.city;
  return out;
}

type AiStop = { address: string; city: string; time?: string };
type AiExtract = { ref?: string; rate?: number; billTo?: string; pickups: AiStop[]; dropoffs: AiStop[] };

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
  const [rate, setRate] = useState("");
  const [stops, setStops] = useState<{ pickups: string[]; deliveries: string[] } | null>(null);
  const [ai, setAi] = useState<AiExtract | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [step, setStep] = useState(1);

  function copyText(t: string) {
    navigator.clipboard?.writeText(t);
    toast("Copied", "Address copied — paste it into the field.");
  }

  async function onConfirmation(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    try {
      const text = await extractText(file);
      setPdfName(file.name || "Rate Confirmation.pdf");
      // Keep the original PDF so it can be opened/viewed in the form.
      const reader = new FileReader();
      reader.onload = () => setPdfUrl(String(reader.result));
      reader.readAsDataURL(file);
      const p = parseConfirmation(text);
      if (p.ref) setRef(p.ref);
      if (p.pickups[0]) setOrigin(p.pickups[0]);
      else if (p.origin) setOrigin(p.origin);
      if (p.deliveries[p.deliveries.length - 1]) setDest(p.deliveries[p.deliveries.length - 1]);
      else if (p.dest) setDest(p.dest);
      if (p.rate) setRate(String(p.rate));
      setStops({ pickups: p.pickups, deliveries: p.deliveries });

      // Then ask the AI to read it precisely (server-side, needs ANTHROPIC_API_KEY).
      try {
        const aiRes = await fetch("/api/ai/rate-con", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const aiData = await aiRes.json();
        if (aiRes.ok && aiData.ok && aiData.result) {
          const r = aiData.result as AiExtract;
          setAi(r);
          if (r.ref) setRef(r.ref);
          if (r.rate) setRate(String(r.rate));
          const firstPick = r.pickups[0];
          const lastDrop = r.dropoffs[r.dropoffs.length - 1];
          if (firstPick) setOrigin(firstPick.address || firstPick.city);
          if (lastDrop) setDest(lastDrop.address || lastDrop.city);
          toast(
            "AI read the rate con",
            `Found ${r.pickups.length} pickup(s) and ${r.dropoffs.length} drop-off(s). Please verify.`
          );
          setStep(2);
          return;
        }
      } catch {
        /* fall through to heuristic result below */
      }

      const np = p.pickups.length || (p.origin ? 1 : 0);
      const nd = p.deliveries.length || (p.dest ? 1 : 0);
      if (np || nd || p.rate || p.brokerName)
        toast("Imported", `Found ${np} pickup(s) and ${nd} delivery(ies). Check the fields.`);
      else toast("Nothing found", "Couldn't read it — enter the details manually.");
      setStep(2);
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
      // Build the multi-stop list from the AI result (if any).
      const stops = ai
        ? [
            ...ai.pickups.map((p) => ({ kind: "pickup", address: p.address || p.city, time: p.time })),
            ...ai.dropoffs.map((d) => ({ kind: "dropoff", address: d.address || d.city, time: d.time })),
          ]
        : undefined;
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref, originName: origin, destName: dest,
          driverName, driverEmail,
          rate: Number(rate) > 0 ? Number(rate) : undefined,
          stops,
          billTo: ai?.billTo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Could not create", data.error || "Try again.");
      else {
        // Attach the rate confirmation PDF to the load so it's saved and the
        // driver can open/download it later — no need to upload it again.
        if (pdfUrl) {
          try {
            await fetch(`/api/loads/${data.load.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "document",
                docType: "rate_confirmation",
                name: pdfName || "Rate Confirmation.pdf",
                dataUrl: pdfUrl,
              }),
            });
          } catch {
            /* the load is already created; ignore attach failure */
          }
        }
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

      <div className="wiz-steps">
        <div className={`wiz-step${step >= 1 ? " on" : ""}`}><span>1</span> Upload PDF</div>
        <div className="wiz-bar" />
        <div className={`wiz-step${step >= 2 ? " on" : ""}`}><span>2</span> Verify</div>
        <div className="wiz-bar" />
        <div className={`wiz-step${step >= 3 ? " on" : ""}`}><span>3</span> Confirm</div>
      </div>

      {/* STEP 1 — upload */}
      {step === 1 && (
        <div>
          <label className="btn btn-ghost btn-block" style={{ marginBottom: 14, cursor: "pointer" }}>
            <FileUp size={16} /> {reading ? "Reading PDF…" : "Import from rate confirmation (PDF)"}
            <input type="file" accept="application/pdf" hidden onChange={onConfirmation} disabled={reading} />
          </label>
          <p className="px">
            Upload the broker’s rate confirmation. The AI reads it and detects every
            pickup and drop-off, so you just check the result on the next step.
          </p>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 4 }} onClick={() => setStep(3)} disabled={reading}>
            Skip — enter details manually
          </button>
        </div>
      )}

      {/* STEP 2 — verify */}
      {step === 2 && (
        <div>
          {ai ? (
            <div className="ai-card">
              <div className="ai-head">
                <span className="ai-badge">AI</span>
                Found <b>{ai.pickups.length}</b> pickup{ai.pickups.length === 1 ? "" : "s"} ·{" "}
                <b>{ai.dropoffs.length}</b> drop-off{ai.dropoffs.length === 1 ? "" : "s"} — verify below
              </div>
              {ai.pickups.map((s, i) => (
                <div key={`ap${i}`} className="ai-stop">
                  <span className="ai-dot up">↑</span>
                  <div className="ai-stop-body">
                    <div className="ai-addr">{s.address || s.city}</div>
                    {s.time && <div className="ai-time">{s.time}</div>}
                  </div>
                  <button type="button" className="copy-link" onClick={() => { setOrigin(s.address || s.city); copyText(s.address || s.city); }}>
                    Use as origin
                  </button>
                </div>
              ))}
              {ai.dropoffs.map((s, i) => (
                <div key={`ad${i}`} className="ai-stop">
                  <span className="ai-dot down">↓</span>
                  <div className="ai-stop-body">
                    <div className="ai-addr">{s.address || s.city}</div>
                    {s.time && <div className="ai-time">{s.time}</div>}
                  </div>
                  <button type="button" className="copy-link" onClick={() => { setDest(s.address || s.city); copyText(s.address || s.city); }}>
                    Use as destination
                  </button>
                </div>
              ))}
            </div>
          ) : (
            stops && (stops.pickups.length > 0 || stops.deliveries.length > 0) && (
              <div className="inv-calc" style={{ marginBottom: 14 }}>
                <div><span>Pickups</span><b>{stops.pickups.length}</b></div>
                {stops.pickups.map((s, i) => (
                  <div key={`p${i}`} className="addr-pick">
                    <span className="px" style={{ flex: 1 }}>↑ {s}</span>
                    <button type="button" className="copy-link" onClick={() => { setOrigin(s); copyText(s); }}>
                      Use as origin
                    </button>
                  </div>
                ))}
                <div className="inv-total"><span>Deliveries</span><b>{stops.deliveries.length}</b></div>
                {stops.deliveries.map((s, i) => (
                  <div key={`d${i}`} className="addr-pick">
                    <span className="px" style={{ flex: 1 }}>↓ {s}</span>
                    <button type="button" className="copy-link" onClick={() => { setDest(s); copyText(s); }}>
                      Use as destination
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {pdfUrl && (
            <div className="pdf-box">
              <div className="pdf-head">
                <b>Rate confirmation — click words to fill addresses</b>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="copy-link">
                  Open PDF ↗
                </a>
              </div>
              <PdfPicker
                dataUrl={pdfUrl}
                onOrigin={(t) => { setOrigin(t); copyText(t); }}
                onDestination={(t) => { setDest(t); copyText(t); }}
              />
              <p className="hint" style={{ marginTop: 2 }}>
                This PDF is saved to the load automatically — the driver can open and download it.
              </p>
            </div>
          )}

          <div className="wiz-nav">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Next: confirm →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — confirm */}
      {step === 3 && (
        <div>
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
              <label>Origin (City, ST or full address)</label>
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Dallas, TX" />
            </div>
            <div className="field">
              <label>Destination (City, ST or full address)</label>
              <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Atlanta, GA" />
            </div>
          </div>

          <div className="wiz-nav">
            <button className="btn btn-ghost" onClick={() => setStep(pdfUrl ? 2 : 1)}>← Back</button>
            <button className="btn btn-primary" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create load"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
