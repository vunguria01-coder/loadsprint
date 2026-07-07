import type { SupportTicket, TicketCategory, TicketSeverity } from "@/lib/support";

export type Triage = {
  category: TicketCategory;
  severity: TicketSeverity;
  report: string; // internal analysis + suggested fix for the admin
  draftReply: string; // suggested reply to the dispatcher
};

const CATEGORIES: TicketCategory[] = ["question", "bug", "account", "billing", "feature", "other"];
const SEVERITIES: TicketSeverity[] = ["low", "medium", "high"];

const SYSTEM = `You are the support triage assistant for LoadSprint, a freight-dispatch SaaS used by truck dispatchers. LoadSprint's features: AI rate-confirmation import, multi-stop loads, live GPS driver tracking with road-route ETA, a broker tracking portal, AI invoices & broker document packets, driver mobile app, per-load profit/P&L, broker receivables (A/R) tracking, trucks (costs/fuel cards/maintenance/reports), reminders (document expiry & maintenance), settlements (driver pay), plans & billing (Silver/Gold/Platinum by driver count).

You are given ONE dispatcher's support ticket plus a short summary of their account. Reply with ONLY a JSON object, no prose, no markdown fences. Shape:
{"category":"question|bug|account|billing|feature|other","severity":"low|medium|high","report":"...","draftReply":"..."}
Rules:
- "category": question = how-to/usage; bug = something broken; account = login/access/data; billing = plans/payment; feature = a request; other = anything else.
- "severity": high = blocked from working / data loss / paid feature broken; medium = a feature misbehaves but there's a workaround; low = minor or a simple question.
- "report" = an INTERNAL note for the human admin (not shown to the dispatcher): the likely cause, and concrete next steps or a suggested fix. Be specific and reference LoadSprint features/screens. If it's a code bug, say what to check. If it's account/billing, say what to change. 2-5 sentences.
- "draftReply" = a friendly, clear reply the admin can send to the dispatcher. Answer the question or acknowledge the issue and say what happens next. Warm, concise, no fake promises. Do not invent account details.
- Never claim an action was taken — the admin reviews and sends everything.`;

export async function aiTriage(ticket: SupportTicket, accountContext: string): Promise<Triage | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const body = {
    model: "claude-opus-4-8",
    max_tokens: 1200,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Account: ${accountContext}\n\n` +
          `Ticket subject: ${ticket.subject}\n` +
          `Ticket message:\n${ticket.message.slice(0, 3500)}`,
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
    const data = await res.json();
    const raw = Array.isArray(data?.content)
      ? data.content.map((c: { text?: string }) => c.text || "").join("")
      : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    const p = JSON.parse(clean.slice(s, e + 1)) as Record<string, unknown>;

    const category = CATEGORIES.includes(p.category as TicketCategory)
      ? (p.category as TicketCategory)
      : "other";
    const severity = SEVERITIES.includes(p.severity as TicketSeverity)
      ? (p.severity as TicketSeverity)
      : "medium";
    const report = typeof p.report === "string" ? p.report.slice(0, 2000) : "";
    const draftReply = typeof p.draftReply === "string" ? p.draftReply.slice(0, 2000) : "";
    if (!report && !draftReply) return null;
    return { category, severity, report, draftReply };
  } catch {
    return null;
  }
}
