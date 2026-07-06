// Apply a natural-language edit to a structured rate-confirmation copy using
// Claude. The key lives in ANTHROPIC_API_KEY (server-only). Returns the updated
// data, or null if the API is unavailable / the response can't be parsed.
import type { ConfirmationData } from "@/lib/confirmation-pdf";

const SYSTEM = `You edit a US truckload rate-confirmation's structured data based on a dispatcher's instruction. Reply with ONLY the full updated JSON object (no prose, no markdown fences), same shape as the input:
{"ref": string?, "rate": number?, "brokerName": string?, "brokerContact": string?, "billTo": string?, "driverName": string?, "pickups": [{"address": string, "time": string?}], "dropoffs": [{"address": string, "time": string?}], "notes": string?}
Rules:
- Apply ONLY what the instruction asks; keep every other field exactly as given.
- "rate" is carrier pay in dollars, digits only (no $ or commas).
- Addresses are single-line "street, City, ST ZIP" where possible.
- Never invent stops or values the instruction didn't provide. Return the complete object, not a diff.`;

export async function aiEditConfirmation(
  data: ConfirmationData,
  instruction: string
): Promise<ConfirmationData | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !instruction.trim()) return null;

  const body = {
    model: "claude-opus-4-8",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Current data:\n${JSON.stringify(data)}\n\nInstruction: ${instruction.slice(0, 500)}`,
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
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const out = await res.json();
    const raw = Array.isArray(out?.content)
      ? out.content.map((c: { text?: string }) => c.text || "").join("")
      : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    const p = JSON.parse(clean.slice(s, e + 1)) as Record<string, unknown>;

    const stops = (v: unknown) =>
      Array.isArray(v)
        ? v
            .map((x) => {
              const o = x as Record<string, unknown>;
              return {
                address: typeof o.address === "string" ? o.address.trim() : "",
                time: typeof o.time === "string" ? o.time.trim() : undefined,
              };
            })
            .filter((x) => x.address)
        : [];

    return {
      ...data,
      ref: typeof p.ref === "string" ? p.ref : data.ref,
      rate: typeof p.rate === "number" ? p.rate : data.rate,
      brokerName: typeof p.brokerName === "string" ? p.brokerName : data.brokerName,
      brokerContact: typeof p.brokerContact === "string" ? p.brokerContact : data.brokerContact,
      billTo: typeof p.billTo === "string" ? p.billTo : data.billTo,
      driverName: typeof p.driverName === "string" ? p.driverName : data.driverName,
      pickups: p.pickups !== undefined ? stops(p.pickups) : data.pickups,
      dropoffs: p.dropoffs !== undefined ? stops(p.dropoffs) : data.dropoffs,
      notes: typeof p.notes === "string" ? p.notes : data.notes,
    };
  } catch {
    return null;
  }
}
