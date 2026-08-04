// Server-side AI extraction of a rate confirmation's structured data using the
// Anthropic API. The key lives in ANTHROPIC_API_KEY (set in Railway) and is
// never exposed to the browser.

export type AiStop = {
  address: string; // FULL address: street number + street, City, ST ZIP
  city: string; // "City, ST"
  time?: string; // appointment / window if present
};

export type AiExtract = {
  ref?: string;
  rate?: number;
  billTo?: string; // broker/customer to invoice (the payer)
  pickups: AiStop[];
  dropoffs: AiStop[];
};

const SYSTEM = `You read US/Canada truckload "rate confirmation" documents and extract structured stop data. Reply with ONLY a JSON object, no prose, no markdown fences. Shape:
{"ref": string optional, "rate": number optional (carrier total pay in dollars, digits only), "billTo": string optional (the broker/brokerage or customer company that pays the carrier — name, and address/email if shown), "pickups": [{"address": string, "city": "City, ST", "time": string optional}], "dropoffs": [{"address": string, "city": "City, ST", "time": string optional}]}
Rules:
- List EVERY pickup and EVERY delivery, in order. A load can have up to 10 pickups and up to 10 deliveries.
- "address" MUST be the COMPLETE single-line address: street number + street name + city + 2-letter state + 5-digit ZIP (e.g. "10000 Main St, Dallas, TX 75201"). Always include the ZIP code. If the document shows the address split across lines, combine it into one full line. Only fall back to just "City, ST" when no street address exists anywhere in the document for that stop.
- "city" must be "City, ST" (2-letter state).
- "billTo" = the company the invoice should be sent to (usually the broker on the rate con).
- Omit fields you cannot find. Never invent stops, addresses, ZIPs, or a payer.`;

export type AiScope = "all" | "addresses_rate" | "addresses";

type ContentBlock = Record<string, unknown>;

// Turn Claude's reply into our shape. Shared by the text and the PDF path so
// both stay in sync.
function parseExtract(raw: string, scope: AiScope): AiExtract | null {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const parsed = JSON.parse(clean.slice(start, end + 1));

  const norm = (arr: unknown): AiStop[] =>
    Array.isArray(arr)
      ? arr
          .map((s) => {
            const o = s as Record<string, unknown>;
            const city = typeof o.city === "string" ? o.city.trim() : "";
            const address = typeof o.address === "string" && o.address.trim() ? o.address.trim() : city;
            const time = typeof o.time === "string" ? o.time.trim() : undefined;
            return { address, city, time };
          })
          .filter((s) => s.city || s.address)
      : [];

  // Respect the chosen scope: only addresses, addresses + rate, or everything.
  const wantRate = scope === "all" || scope === "addresses_rate";
  const wantPayer = scope === "all";
  return {
    ref: typeof parsed.ref === "string" ? parsed.ref : undefined,
    rate: wantRate && typeof parsed.rate === "number" ? parsed.rate : undefined,
    billTo: wantPayer && typeof parsed.billTo === "string" ? parsed.billTo : undefined,
    pickups: norm(parsed.pickups),
    dropoffs: norm(parsed.dropoffs),
  };
}

async function callClaude(
  model: string,
  content: ContentBlock[],
  maxTokens: number,
  timeoutMs: number
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }),
    // Cap the call so a slow/unreachable API can't hang the request forever.
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data?.content)
    ? data.content.map((c: { text?: string }) => c.text || "").join("")
    : "";
}

export async function aiExtractRateCon(
  text: string,
  scope: AiScope = "all"
): Promise<AiExtract | null> {
  if (!process.env.ANTHROPIC_API_KEY || !text.trim()) return null;
  try {
    // Keep the payload reasonable — rate cons are short; cap to ~16k chars.
    const raw = await callClaude(
      "claude-sonnet-4-6",
      [
        {
          type: "text",
          text: `Extract the stops from this rate confirmation text:\n\n${text.slice(0, 16000)}`,
        },
      ],
      1024,
      60000
    );
    return raw === null ? null : parseExtract(raw, scope);
  } catch {
    return null;
  }
}

// Scanned rate confirmations have no text layer at all — pdf.js returns nothing,
// so there is nothing to send as text. Claude reads a PDF natively when it is
// passed as a document block (it sees the pages), which is exactly what a scan
// needs; no OCR dependency required.
export async function aiExtractRateConPdf(
  base64Pdf: string,
  scope: AiScope = "all"
): Promise<AiExtract | null> {
  if (!process.env.ANTHROPIC_API_KEY || !base64Pdf) return null;
  try {
    const raw = await callClaude(
      "claude-opus-5", // reading a scan is a vision task — accuracy of addresses matters
      [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
        },
        {
          type: "text",
          text: "Extract the stops from this rate confirmation. It may be a scanned image — read the page carefully.",
        },
      ],
      2048,
      // A scan takes longer to read than plain text.
      120000
    );
    return raw === null ? null : parseExtract(raw, scope);
  } catch {
    return null;
  }
}
