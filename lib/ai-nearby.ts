import type { NearbyLoad } from "@/lib/nearby-loads";

// Server-side AI briefing for the driver's "near you" block. Claude sees where
// the truck is and the driver's active loads with deadhead miles, and writes a
// one-line plan plus a short note per load. Key lives in ANTHROPIC_API_KEY and
// is never exposed to the browser. Returns null on any failure so the block
// still renders with plain distances.

export type NearbyBrief = {
  summary: string; // one line: what to do next
  notes: Record<string, string>; // loadId -> short note
};

const MODEL = "claude-opus-5";

const SYSTEM = `You are a dispatch assistant talking to a truck driver inside LoadSprint's driver app. You get the driver's current location and the loads assigned to them, each with the distance from the driver to the next place that load needs them (the pickup if the freight isn't loaded yet, the delivery if it is).

Reply with ONLY a JSON object, no prose, no markdown fences. Shape:
{"summary":"...","notes":{"<load id>":"...","<load id>":"..."}}
Rules:
- "summary" = one sentence, max 110 characters, telling the driver what to do next (which load to head to and why). Speak to the driver directly.
- "notes" = one entry per load id you were given, max 90 characters each. Say what matters: deadhead miles, pay, pay per mile if both rate and miles are known, whether the appointment is today or late.
- Use ONLY the data given. Never invent rates, appointments, cities, or traffic/weather conditions.
- Plain trucker English, no emoji, no marketing tone, no repeating the load reference (it's already on the card).`;

function loadLine(l: NearbyLoad): string {
  const parts = [
    `id=${l.id}`,
    `ref=${l.ref}`,
    `route=${l.originName} -> ${l.destName}`,
    `status=${l.status}`,
    `next=${l.targetKind} at ${l.targetName}`,
    `distance=${l.miles} mi`,
  ];
  if (l.rate != null) parts.push(`pay=$${l.rate}`);
  if (l.pickupDate) parts.push(`pickup date=${l.pickupDate}`);
  if (l.deliveryDate) parts.push(`delivery date=${l.deliveryDate}`);
  return parts.join(" | ");
}

export async function aiBriefNearby(
  locationLabel: string,
  loads: NearbyLoad[]
): Promise<NearbyBrief | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || loads.length === 0) return null;

  const body = {
    model: MODEL,
    // Opus 5 thinks by default and max_tokens covers thinking + the JSON, so
    // leave headroom — a truncated reply parses to nothing.
    max_tokens: 4000,
    system: SYSTEM,
    // Low effort: this is a short ranking/summarising task, and the driver is
    // waiting on the screen for it.
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content:
          `Driver is currently at: ${locationLabel}\n\n` +
          `Their loads (nearest first):\n` +
          loads.map(loadLine).join("\n"),
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
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.stop_reason === "refusal") return null;
    const raw = Array.isArray(data?.content)
      ? data.content.map((c: { text?: string }) => c.text || "").join("")
      : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    const p = JSON.parse(clean.slice(s, e + 1)) as Record<string, unknown>;

    const summary = typeof p.summary === "string" ? p.summary.slice(0, 200) : "";
    const notes: Record<string, string> = {};
    if (p.notes && typeof p.notes === "object") {
      for (const [id, text] of Object.entries(p.notes as Record<string, unknown>)) {
        // Ignore ids Claude invented — only annotate loads we actually sent.
        if (typeof text === "string" && loads.some((l) => l.id === id)) {
          notes[id] = text.slice(0, 160);
        }
      }
    }
    if (!summary && Object.keys(notes).length === 0) return null;
    return { summary, notes };
  } catch {
    return null;
  }
}

// The driver app polls, so cache each briefing for a few minutes. The key
// includes the loads and the rounded position, so a real move or a load change
// gets a fresh answer while idle polling doesn't burn tokens.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; brief: NearbyBrief | null }>();

export async function aiBriefNearbyCached(
  email: string,
  point: { lat: number; lng: number },
  locationLabel: string,
  loads: NearbyLoad[]
): Promise<NearbyBrief | null> {
  const key = [
    email.toLowerCase(),
    point.lat.toFixed(2),
    point.lng.toFixed(2),
    loads.map((l) => `${l.id}:${l.status}:${l.miles}`).join(","),
  ].join("|");

  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.brief;

  const brief = await aiBriefNearby(locationLabel, loads);
  cache.set(key, { at: now, brief });
  // Keep the map from growing without bound on a long-lived server.
  if (cache.size > 500) {
    for (const [k, v] of cache) {
      if (now - v.at > TTL_MS) cache.delete(k);
    }
  }
  return brief;
}
