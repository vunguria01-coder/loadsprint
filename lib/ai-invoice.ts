// Server-side AI invoice generation using the Anthropic API. The AI builds a
// clean carrier invoice (line items + total) from the load's data. Key lives in
// ANTHROPIC_API_KEY and is never exposed to the browser.

export type InvoiceLine = { label: string; amount: number };
export type AiInvoice = {
  invoiceNumber: string;
  date: string;
  billTo: string;
  lines: InvoiceLine[];
  subtotal: number;
  total: number;
  notes?: string;
};

type InvoiceInput = {
  ref: string;
  originName: string;
  destName: string;
  rate?: number;
  stops?: { kind: string; address: string }[];
  driverName: string;
  dispatcherName?: string;
};

const SYSTEM = `You are an accounts-receivable assistant for a freight carrier. Build a clean, correct carrier invoice from the load data. Reply with ONLY a JSON object, no prose, no markdown. Shape:
{"invoiceNumber": string, "date": "YYYY-MM-DD", "billTo": string, "lines": [{"label": string, "amount": number}], "subtotal": number, "total": number, "notes": string optional}
Rules: the main line is the line haul (the agreed load rate). Add separate lines only for items clearly present in the data (extra stops as "Additional stop", etc.). Amounts are USD numbers (no symbols). subtotal = sum of lines; total = subtotal (no tax unless stated). Keep it professional and minimal. Never invent charges that aren't supported by the data.`;

export async function aiGenerateInvoice(input: InvoiceInput): Promise<AiInvoice | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const today = new Date().toISOString().slice(0, 10);
  const stopsText =
    input.stops && input.stops.length > 0
      ? input.stops.map((s) => `${s.kind}: ${s.address}`).join("; ")
      : `pickup: ${input.originName}; dropoff: ${input.destName}`;

  const userMsg = `Create an invoice for this completed load.
Load reference: ${input.ref}
Route: ${input.originName} -> ${input.destName}
Stops: ${stopsText}
Agreed load rate (line haul): ${input.rate != null ? `$${input.rate}` : "not provided"}
Carrier/driver: ${input.driverName}
Today's date: ${today}
Use the load reference in the invoice number (e.g. INV-${input.ref}).`;

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = Array.isArray(data?.content)
      ? data.content.map((c: { text?: string }) => c.text || "").join("")
      : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const p = JSON.parse(clean.slice(start, end + 1));

    const lines: InvoiceLine[] = Array.isArray(p.lines)
      ? p.lines
          .map((l: { label?: unknown; amount?: unknown }) => ({
            label: String(l.label || "").trim(),
            amount: Number(l.amount) || 0,
          }))
          .filter((l: InvoiceLine) => l.label)
      : [];
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);

    return {
      invoiceNumber: String(p.invoiceNumber || `INV-${input.ref}`),
      date: String(p.date || today),
      billTo: String(p.billTo || ""),
      lines,
      subtotal: typeof p.subtotal === "number" ? p.subtotal : subtotal,
      total: typeof p.total === "number" ? p.total : subtotal,
      notes: typeof p.notes === "string" ? p.notes : undefined,
    };
  } catch {
    return null;
  }
}
