// Builds a carrier invoice straight from the load's own data — no AI, no network.
// Everything on the invoice is either typed by the dispatcher (company profile)
// or already stored on the load (stops, rate, payer), so an invoice can always
// be produced, and the amounts are exactly the ones on the load.

import type { Load } from "@/lib/loads";
import type { InvoiceProfile } from "@/lib/schemas";

export type InvoiceItem = {
  description: string; // may contain several lines separated by "\n"
  quantity: number;
  rate: number;
};

export type InvoiceCompany = {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logoDataUrl: string;
  notes: string;
};

export type InvoiceDoc = {
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  terms: string; // e.g. "NET 30"
  billTo: string; // multi-line
  shipTo: string; // multi-line
  trackingNo: string;
  shipVia: string;
  fob: string;
  items: InvoiceItem[];
  taxPercent: number;
  shipping: number;
  paid: number;
  company: InvoiceCompany;
};

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  total: number;
  balanceDue: number;
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// The single source of truth for every figure on the invoice. The renderer and
// the editor both call this, so what the dispatcher sees is what gets printed.
export function invoiceTotals(inv: InvoiceDoc): InvoiceTotals {
  const subtotal = round2(
    inv.items.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0)
  );
  const tax = round2((subtotal * (Number(inv.taxPercent) || 0)) / 100);
  const total = round2(subtotal + tax + (Number(inv.shipping) || 0));
  return { subtotal, tax, total, balanceDue: round2(total - (Number(inv.paid) || 0)) };
}

/* ---------- dates ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-05-27" -> "05/27/2026" (the format on the reference invoice).
export function usDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : String(iso || "");
}

export function addDays(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + (Number(days) || 0));
  return toIsoDay(d);
}

// Stop times come off a rate confirmation as free text ("07/31/2026 0800",
// "08/01/2026 0800-1200", "Jul 31 2026"). Pull a day out of it when we can.
function dayFromText(text?: string): string | undefined {
  const t = String(text || "");
  const us = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(t);
  if (us) {
    const year = Number(us[3].length === 2 ? `20${us[3]}` : us[3]);
    return `${year}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
  }
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return undefined;
}

/* ---------- draft ---------- */

// One description line per stop, in the shape of the reference invoice:
//   "Pickup 05/27/2026 Portland Or, 97211"
//   "Delivery 05/28/2026 Spokane WA, 99217"
function describeStops(load: Load): string {
  const lines: string[] = [];
  const stops = load.stops || [];
  if (stops.length > 0) {
    for (const s of stops) {
      const label = s.kind === "pickup" ? "Pickup" : "Delivery";
      const day =
        dayFromText(s.time) ||
        (s.kind === "pickup" ? load.pickupDate : load.deliveryDate);
      lines.push([label, day ? usDate(day) : "", s.address].filter(Boolean).join(" "));
    }
  } else {
    // Loads created before multi-stop, or entered by hand, only carry endpoints.
    if (load.originName)
      lines.push(
        ["Pickup", load.pickupDate ? usDate(load.pickupDate) : "", load.originName]
          .filter(Boolean)
          .join(" ")
      );
    if (load.destName)
      lines.push(
        ["Delivery", load.deliveryDate ? usDate(load.deliveryDate) : "", load.destName]
          .filter(Boolean)
          .join(" ")
      );
  }
  return lines.join("\n");
}

export function buildInvoiceDraft(
  load: Load,
  profile: InvoiceProfile,
  invoiceNumber?: string
): InvoiceDoc {
  const today = toIsoDay(new Date());
  const rate = Number(load.loadRate) || 0;
  return {
    // The real number is allocated when the invoice is saved; until then this is
    // only a placeholder the dispatcher can overwrite.
    invoiceNumber: invoiceNumber ?? String(profile.nextInvoiceNumber || ""),
    date: today,
    dueDate: addDays(today, Number(profile.termsDays) || 0),
    terms: profile.terms || "",
    billTo: load.billTo || load.brokerContactName || load.brokerName || "",
    shipTo: "",
    trackingNo: load.ref || "",
    shipVia: "",
    fob: "",
    items: [{ description: describeStops(load), quantity: 1, rate }],
    taxPercent: Number(profile.taxPercent) || 0,
    shipping: 0,
    paid: 0,
    company: {
      name: profile.companyName || "",
      address: profile.address || "",
      phone: profile.phone || "",
      email: profile.email || "",
      taxId: profile.taxId || "",
      logoDataUrl: profile.logoDataUrl || "",
      notes: profile.notes || "",
    },
  };
}

// Normalize whatever the editor posts back so the renderer never sees NaN or a
// runaway string, and the totals stay ours rather than the client's.
export function sanitizeInvoice(input: unknown, fallback: InvoiceDoc): InvoiceDoc {
  const o = (input || {}) as Record<string, unknown>;
  const str = (v: unknown, max: number, dflt = "") =>
    typeof v === "string" ? v.slice(0, max) : dflt;
  const num = (v: unknown, dflt = 0) => (Number.isFinite(Number(v)) ? Number(v) : dflt);

  const items = Array.isArray(o.items)
    ? (o.items as Record<string, unknown>[])
        .map((l) => ({
          description: str(l.description, 2000),
          quantity: num(l.quantity, 1),
          rate: num(l.rate, 0),
        }))
        .filter((l) => l.description || l.rate)
        .slice(0, 20)
    : fallback.items;

  return {
    invoiceNumber: str(o.invoiceNumber, 40, fallback.invoiceNumber),
    date: str(o.date, 10, fallback.date),
    dueDate: str(o.dueDate, 10, fallback.dueDate),
    terms: str(o.terms, 40, fallback.terms),
    billTo: str(o.billTo, 400, fallback.billTo),
    shipTo: str(o.shipTo, 400, fallback.shipTo),
    trackingNo: str(o.trackingNo, 60, fallback.trackingNo),
    shipVia: str(o.shipVia, 60, fallback.shipVia),
    fob: str(o.fob, 60, fallback.fob),
    items: items.length ? items : fallback.items,
    taxPercent: Math.min(100, Math.max(0, num(o.taxPercent, fallback.taxPercent))),
    shipping: Math.max(0, num(o.shipping, 0)),
    paid: Math.max(0, num(o.paid, 0)),
    // The company block always comes from the saved profile, never from the client.
    company: fallback.company,
  };
}
