// Server-side AI extraction of a rate confirmation's structured data using the
// Anthropic API. The key lives in ANTHROPIC_API_KEY (set in Railway) and is
// never exposed to the browser.

export type AiStop = {
  address: string; // full street address if present
  city: string; // "City, ST"
  time?: string; // appointment / window if present
};

export type AiExtract = {
  ref?: string;
  rate?: number;
  pickups: AiStop[];
  dropoffs: AiStop[];
};

const SYSTEM = `You read US/Canada truckload "rate confirmation" documents and extract structured stop data. Reply with ONLY a JSON object, no prose, no markdown fences. Shape:
{"ref": string optional, "rate": number optional (carrier total pay in dollars, digits only), "pickups": [{"address": string, "city": "City, ST", "time": string optional}], "dropoffs": [{"address": string, "city": "City, ST", "time": string optional}]}
Rules: list every pickup and every delivery in order. "address" = full street line if available else same as city. "city" must be "City, ST" (2-letter state). Omit time if unknown. If you cannot find a value, omit it. Never invent stops.`;

export async function aiExtractRateCon(text: string): Promise<AiExtract | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !text.trim()) return null;

  // Keep the payload reasonable — rate cons are short; cap to ~16k chars.
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract the stops from this rate confirmation text:\n\n${text.slice(0, 16000)}`,
      },
    ],
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

    return {
      ref: typeof parsed.ref === "string" ? parsed.ref : undefined,
      rate: typeof parsed.rate === "number" ? parsed.rate : undefined,
      pickups: norm(parsed.pickups),
      dropoffs: norm(parsed.dropoffs),
    };
  } catch {
    return null;
  }
}
