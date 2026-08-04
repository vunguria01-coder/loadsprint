"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus, Phone, Mail } from "lucide-react";
import { useToast } from "@/components/toast";
import { fileToDataUrl } from "@/lib/format";
import { PdfPicker } from "@/components/pdf-picker";
import { CleanConfirmation } from "@/components/clean-confirmation";

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

// A half-filled wizard shouldn't be lost when the tab is closed or reloaded, so
// the typed details are kept in localStorage (per driver) until the load is
// created. The PDF/AI result isn't stored — it's far too big for localStorage.
const DRAFT_KEY = "ls_new_load_draft";
type Draft = {
  step: number;
  ref: string;
  origin: string;
  dest: string;
  rate: string;
  commodity: string;
  weight: string;
  equipment: string;
  pieces: string;
  pickupDate: string;
  deliveryDate: string;
  broker: { name?: string; email?: string; phone?: string } | null;
};

type AiStop = { address: string; city: string; time?: string };
type AiExtract = { ref?: string; rate?: number; billTo?: string; pickups: AiStop[]; dropoffs: AiStop[] };

export function CreateLoad({
  driverName,
  driverEmail,
  canPdf = false,
}: {
  driverName: string;
  driverEmail: string;
  canPdf?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [ref, setRef] = useState("");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [rate, setRate] = useState("");
  // What's on the truck — typed on the confirm step, kept in the draft.
  const [commodity, setCommodity] = useState("");
  const [weight, setWeight] = useState("");
  const [equipment, setEquipment] = useState("");
  const [pieces, setPieces] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [stops, setStops] = useState<{ pickups: string[]; deliveries: string[] } | null>(null);
  const [ai, setAi] = useState<AiExtract | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [step, setStep] = useState(1);
  const [aiScope, setAiScope] = useState<"all" | "addresses_rate" | "addresses">("all");
  const [broker, setBroker] = useState<{ name?: string; email?: string; phone?: string } | null>(null);

  const draftKey = `${DRAFT_KEY}:${driverEmail}`;
  const [restored, setRestored] = useState(false);
  const done = useRef(false);

  // Restore the draft once, on mount (not in useState, so the server-rendered
  // markup and the first client render still match).
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(draftKey); } catch {}
    if (raw) {
      try {
        const d = JSON.parse(raw) as Partial<Draft>;
        if (typeof d.ref === "string") setRef(d.ref);
        if (typeof d.origin === "string") setOrigin(d.origin);
        if (typeof d.dest === "string") setDest(d.dest);
        if (typeof d.rate === "string") setRate(d.rate);
        if (typeof d.commodity === "string") setCommodity(d.commodity);
        if (typeof d.weight === "string") setWeight(d.weight);
        if (typeof d.equipment === "string") setEquipment(d.equipment);
        if (typeof d.pieces === "string") setPieces(d.pieces);
        if (typeof d.pickupDate === "string") setPickupDate(d.pickupDate);
        if (typeof d.deliveryDate === "string") setDeliveryDate(d.deliveryDate);
        if (d.broker && typeof d.broker === "object") setBroker(d.broker);
        // Step 2 only makes sense with the PDF/AI result, which isn't stored —
        // continue on the details step instead.
        if (d.step === 2 || d.step === 3) setStep(3);
      } catch {
        /* corrupt draft — start clean */
      }
    }
    setRestored(true);
  }, [draftKey]);

  // Keep the stored draft in sync with the form.
  useEffect(() => {
    if (!restored || done.current) return;
    const empty =
      step === 1 && !ref && !origin && !dest && !rate && !broker &&
      !commodity && !weight && !equipment && !pieces && !pickupDate && !deliveryDate;
    try {
      if (empty) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({
        step, ref, origin, dest, rate,
        commodity, weight, equipment, pieces, pickupDate, deliveryDate,
        broker,
      } satisfies Draft));
    } catch {}
  }, [restored, draftKey, step, ref, origin, dest, rate, commodity, weight, equipment, pieces, pickupDate, deliveryDate, broker]);

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
      // Keep the original PDF so it can be opened/viewed in the form — and so a
      // scanned document can be handed to the AI as a file below.
      const dataUrl = await fileToDataUrl(file);
      setPdfUrl(dataUrl);
      const p = parseConfirmation(text);
      if (p.ref) setRef(p.ref);
      if (p.pickups[0]) setOrigin(p.pickups[0]);
      else if (p.origin) setOrigin(p.origin);
      if (p.deliveries[p.deliveries.length - 1]) setDest(p.deliveries[p.deliveries.length - 1]);
      else if (p.dest) setDest(p.dest);
      if (p.rate) setRate(String(p.rate));
      setStops({ pickups: p.pickups, deliveries: p.deliveries });
      // Keep the broker's contact so the dispatcher can call them right away.
      if (p.brokerName || p.brokerEmail || p.brokerPhone)
        setBroker({ name: p.brokerName, email: p.brokerEmail, phone: p.brokerPhone });

      // Then ask the AI to read it precisely (server-side, needs ANTHROPIC_API_KEY).
      // A scanned rate con has no text layer at all, so there is nothing to send
      // as text — in that case the PDF itself goes to the AI, which reads the
      // pages. Same fallback if the text path comes back empty-handed.
      const scanned = text.trim().length < 40;
      if (scanned)
        toast("Scanned PDF", "No text layer — reading the pages. This takes a few seconds.");

      const applyAi = (r: AiExtract): boolean => {
        if (r.pickups.length === 0 && r.dropoffs.length === 0 && !r.rate && !r.billTo) return false;
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
        return true;
      };

      type AiTry = { filled: boolean; error: string | null };
      const askAi = async (
        url: string,
        payload: Record<string, unknown>,
        timeout: number
      ): Promise<AiTry> => {
        try {
          const aiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeout),
          });
          const aiData = await aiRes.json().catch(() => ({}));
          if (aiRes.ok && aiData.ok && aiData.result && applyAi(aiData.result as AiExtract))
            return { filled: true, error: null };
          // fetch does not throw on 4xx/5xx — say what actually went wrong
          // instead of silently falling through to "Nothing found".
          if (aiRes.status === 413)
            return { filled: false, error: "This PDF is too large to read (over 10 MB)." };
          if (aiRes.status === 401)
            return { filled: false, error: "Sign in as a dispatcher to use AI reading." };
          return { filled: false, error: aiRes.ok ? null : aiData.error || null };
        } catch {
          return { filled: false, error: "The AI took too long to answer." };
        }
      };

      let aiError: string | null = null;
      if (!scanned) {
        const viaText = await askAi("/api/ai/rate-con", { text, scope: aiScope }, 90000);
        if (viaText.filled) return;
        aiError = viaText.error;
      }
      // Either there was no text layer, or reading the text produced no stops —
      // let the AI look at the pages themselves.
      const viaFile = await askAi("/api/ai/rate-con-file", { dataUrl, scope: aiScope }, 180000);
      if (viaFile.filled) return;
      aiError = viaFile.error || aiError;

      const np = p.pickups.length || (p.origin ? 1 : 0);
      const nd = p.deliveries.length || (p.dest ? 1 : 0);
      if (np || nd || p.rate || p.brokerName)
        toast("Imported", `Found ${np} pickup(s) and ${nd} delivery(ies). Check the fields.`);
      else if (aiError) toast("Couldn't read it", `${aiError} Enter the details manually.`);
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
          commodity: commodity.trim() || undefined,
          weight: Number(weight) > 0 ? Number(weight) : undefined,
          equipment: equipment.trim() || undefined,
          pieces: Number(pieces) > 0 ? Number(pieces) : undefined,
          pickupDate: pickupDate || undefined,
          deliveryDate: deliveryDate || undefined,
          stops,
          billTo: ai?.billTo,
          // Save the broker's contact from the rate con so the dispatcher always
          // sees who to call/email for this load.
          brokerContactName: broker?.name,
          brokerContactEmail: broker?.email,
          brokerContactPhone: broker?.phone,
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
        // The load exists now — drop the draft so the next one starts clean.
        done.current = true;
        try { localStorage.removeItem(draftKey); } catch {}
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

      {/* STEP 1 — choose how to start: import a PDF (AI) or enter manually */}
      {step === 1 && (
        <div className="cl-start">
          <label className="btn btn-primary btn-block" style={{ cursor: "pointer" }}>
            <FileUp size={16} /> {reading ? "Reading PDF…" : "Import from rate confirmation (PDF)"}
            <input type="file" accept="application/pdf" hidden onChange={onConfirmation} disabled={reading} />
          </label>
          <div className="ai-scope-row">
            <span className="ai-scope-label">AI reads:</span>
            <button type="button" className={`ai-scope-opt${aiScope === "all" ? " on" : ""}`} onClick={() => setAiScope("all")}>Everything</button>
            <button type="button" className={`ai-scope-opt${aiScope === "addresses_rate" ? " on" : ""}`} onClick={() => setAiScope("addresses_rate")}>Addresses + rate</button>
            <button type="button" className={`ai-scope-opt${aiScope === "addresses" ? " on" : ""}`} onClick={() => setAiScope("addresses")}>Addresses only</button>
          </div>
          <p className="px" style={{ marginTop: 12 }}>
            Upload the broker’s rate confirmation — the AI detects every pickup and
            drop-off, so you just check the result on the next step.
          </p>

          <div className="cl-or"><span>or</span></div>

          <button className="btn btn-ghost btn-block" onClick={() => setStep(3)} disabled={reading}>
            Enter details manually
          </button>
        </div>
      )}

      {/* STEP 2 — verify */}
      {step === 2 && (
        <div>
          {broker && (broker.name || broker.phone || broker.email) && (
            <div className="broker-card">
              <div className="bc-info">
                <span className="bc-label">Broker · call before you book</span>
                <div className="bc-name">{broker.name || "Broker on the rate con"}</div>
                {broker.email && (
                  <a className="bc-email" href={`mailto:${broker.email}`}>
                    <Mail size={13} /> {broker.email}
                  </a>
                )}
              </div>
              {broker.phone && (
                <a className="btn btn-primary bc-call" href={`tel:${broker.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone size={16} /> Call {broker.phone}
                </a>
              )}
            </div>
          )}
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

          {canPdf && (
          <CleanConfirmation
            driverName={driverName}
            originalPdfUrl={pdfUrl || undefined}
            seed={{
              ref,
              rate,
              billTo: ai?.billTo,
              pickups: ai
                ? ai.pickups.map((p) => ({ address: p.address || p.city, time: p.time }))
                : (stops?.pickups || []).map((a) => ({ address: a })),
              dropoffs: ai
                ? ai.dropoffs.map((p) => ({ address: p.address || p.city, time: p.time }))
                : (stops?.deliveries || []).map((a) => ({ address: a })),
            }}
          />
          )}

          <div className="wiz-nav">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>Edit details</button>
              <button className="btn btn-primary" onClick={create} disabled={busy}>
                {busy ? "Creating…" : "Create load now"}
              </button>
            </div>
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
            <div className="field full">
              <label>What are we hauling? (optional)</label>
              <input value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="Frozen chicken" />
            </div>
            <div className="field">
              <label>Weight (lbs)</label>
              <input type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="42000" />
            </div>
            <div className="field">
              <label>Trailer type</label>
              <input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Reefer 53'" />
            </div>
            <div className="field">
              <label>Pieces (pallets / units)</label>
              <input type="number" min={0} value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="24" />
            </div>
            <div className="field">
              <label>Pickup date</label>
              <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Delivery date</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
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
