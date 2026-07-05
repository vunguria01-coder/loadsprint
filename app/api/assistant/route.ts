// Voice/text assistant "brain". The browser does speech-to-text and text-to-speech
// for free (Web Speech API); this route turns a request into actions using Claude
// with tool use. The Anthropic key (ANTHROPIC_API_KEY) is the same one that reads
// rate confirmations — nothing new to pay for. Uses the cheapest model (Haiku).
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail, type User } from "@/lib/auth";
import {
  getAllLoads,
  getLoadsByDispatcher,
  getLoadsByDriverEmail,
  createLoad,
  setStatus,
  addMessage,
  completedRevenue,
  LOAD_STATUSES,
  type Load,
  type LoadStatus,
} from "@/lib/loads";

const MODEL = "claude-haiku-4-5";

// Pages the assistant can send the user to. Kept in sync with app/ routes.
const PAGES: Record<string, string> = {
  dashboard: "/dashboard",
  loads: "/loads",
  drivers: "/drivers",
  team: "/team",
  billing: "/billing",
  pricing: "/pricing",
  calendar: "/calendar",
  history: "/history",
  insights: "/insights",
  settlements: "/settlements",
  review: "/review",
  invoice_settings: "/invoice-settings",
  active_loads: "/active-loads",
  admin: "/admin",
};

// GET = "who am I" — the widget uses this to show the button only when signed in.
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, role: me.role, name: me.name });
}

type ClientAction = { type: "navigate"; href: string };

function visibleLoads(me: User): Load[] {
  if (me.role === "admin") return getAllLoads();
  if (me.role === "driver") return getLoadsByDriverEmail(me.email);
  return getLoadsByDispatcher(me.id);
}

function findLoad(me: User, ref: string): Load | undefined {
  const r = String(ref || "").trim().toLowerCase();
  if (!r) return undefined;
  const loads = visibleLoads(me);
  return (
    loads.find((l) => l.ref.toLowerCase() === r) ||
    loads.find((l) => l.ref.toLowerCase().includes(r))
  );
}

function canWriteLoad(me: User, load: Load): boolean {
  if (me.role === "admin") return true;
  if (me.role === "dispatcher") return load.dispatcherId === me.id;
  if (me.role === "driver") return load.driverEmail === me.email;
  return false;
}

const TOOLS = [
  {
    name: "list_loads",
    description:
      "List the loads the current user can see (dispatcher: their own; driver: assigned to them; admin: all). Optionally filter by status.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Optional status filter, e.g. 'In Transit' or 'Delivered'.",
        },
      },
    },
  },
  {
    name: "get_load",
    description: "Get full details of one load by its reference (e.g. LS-48217).",
    input_schema: {
      type: "object",
      properties: { ref: { type: "string" } },
      required: ["ref"],
    },
  },
  {
    name: "list_drivers",
    description: "List the drivers the dispatcher works with and how many loads each has.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_earnings",
    description: "Get the dispatcher's earnings summary (completed loads and total revenue).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_load",
    description:
      "Create a new load. Only for dispatcher/admin. Requires a driver email, origin and destination city. Rate is optional.",
    input_schema: {
      type: "object",
      properties: {
        driverEmail: { type: "string" },
        originName: { type: "string", description: "Pickup city, e.g. 'Dallas, TX'." },
        destName: { type: "string", description: "Delivery city, e.g. 'Atlanta, GA'." },
        rate: { type: "number", description: "Optional load rate in dollars." },
      },
      required: ["driverEmail", "originName", "destName"],
    },
  },
  {
    name: "set_status",
    description: `Change a load's status. Valid statuses: ${LOAD_STATUSES.join(", ")}.`,
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string" },
        status: { type: "string", enum: LOAD_STATUSES as unknown as string[] },
      },
      required: ["ref", "status"],
    },
  },
  {
    name: "message_driver",
    description: "Send a chat message to the driver of a load. Only for dispatcher/admin.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string" },
        text: { type: "string" },
      },
      required: ["ref", "text"],
    },
  },
  {
    name: "navigate",
    description:
      "Open a page for the user. Use 'page' for a known section, or pass 'loadRef' to open a specific load's workspace.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", enum: Object.keys(PAGES) },
        loadRef: { type: "string", description: "Open this specific load, e.g. LS-48217." },
      },
    },
  },
];

type ToolResult = { content: string; action?: ClientAction };

async function execTool(name: string, input: any, me: User): Promise<ToolResult> {
  try {
    switch (name) {
      case "list_loads": {
        let loads = visibleLoads(me);
        const status = String(input?.status || "").trim().toLowerCase();
        if (status) loads = loads.filter((l) => l.status.toLowerCase() === status);
        if (loads.length === 0) return { content: "No loads found." };
        const lines = loads
          .slice(0, 25)
          .map(
            (l) =>
              `${l.ref}: ${l.originName} -> ${l.destName}, driver ${l.driverName || l.driverEmail}, status ${l.status}`
          );
        return { content: `${loads.length} load(s):\n${lines.join("\n")}` };
      }
      case "get_load": {
        const l = findLoad(me, input?.ref);
        if (!l) return { content: `No load matching "${input?.ref}".` };
        const rate = l.loadRate ? `, rate $${l.loadRate}` : "";
        return {
          content: `${l.ref}: ${l.originName} -> ${l.destName}, driver ${l.driverName || l.driverEmail}, broker ${l.brokerName || "n/a"}, status ${l.status}${rate}, ${l.documents.length} documents, ${l.photos.length} photos.`,
        };
      }
      case "list_drivers": {
        const loads = visibleLoads(me);
        const map = new Map<string, { name: string; count: number }>();
        for (const l of loads) {
          if (!l.driverEmail) continue;
          const e = l.driverEmail;
          const cur = map.get(e) || { name: l.driverName || e, count: 0 };
          cur.count += 1;
          map.set(e, cur);
        }
        if (map.size === 0) return { content: "No drivers yet." };
        const lines = [...map.entries()].map(
          ([email, d]) => `${d.name} (${email}): ${d.count} load(s)`
        );
        return { content: lines.join("\n") };
      }
      case "get_earnings": {
        if (me.role === "driver") return { content: "Earnings are for dispatchers." };
        const { count, total } = completedRevenue(me.id);
        const pct = me.commissionPct ?? 0;
        const commission = pct ? ` Your commission ${pct}% = $${Math.round((total * pct) / 100)}.` : "";
        return { content: `Completed loads: ${count}. Total revenue: $${total}.${commission}` };
      }
      case "create_load": {
        if (me.role !== "dispatcher" && me.role !== "admin")
          return { content: "Only dispatchers can create loads." };
        if (me.role === "dispatcher" && !hasAccess(me))
          return { content: "Activate a plan first to create loads." };
        const driverEmail = String(input?.driverEmail || "").trim().toLowerCase();
        const originName = String(input?.originName || "").trim();
        const destName = String(input?.destName || "").trim();
        if (!driverEmail || !originName || !destName)
          return { content: "Need driver email, origin and destination." };
        const existing = visibleLoads(me).find((l) => l.driverEmail === driverEmail);
        const driverName = existing?.driverName || findByEmail(driverEmail)?.name || driverEmail;
        const load = createLoad({
          dispatcherId: me.id,
          driverName,
          driverEmail,
          originName,
          destName,
          rate: Number(input?.rate) > 0 ? Number(input?.rate) : undefined,
        });
        return {
          content: `Created load ${load.ref}: ${originName} -> ${destName} for ${driverName}.`,
          action: { type: "navigate", href: `/loads/${load.id}` },
        };
      }
      case "set_status": {
        const l = findLoad(me, input?.ref);
        if (!l) return { content: `No load matching "${input?.ref}".` };
        if (!canWriteLoad(me, l)) return { content: "You cannot change this load." };
        const status = LOAD_STATUSES.find(
          (s) => s.toLowerCase() === String(input?.status || "").trim().toLowerCase()
        );
        if (!status) return { content: `Invalid status. Use: ${LOAD_STATUSES.join(", ")}.` };
        setStatus(l.id, status as LoadStatus, me.id);
        return { content: `Load ${l.ref} is now "${status}".` };
      }
      case "message_driver": {
        if (me.role !== "dispatcher" && me.role !== "admin")
          return { content: "Only dispatchers can message drivers." };
        const l = findLoad(me, input?.ref);
        if (!l) return { content: `No load matching "${input?.ref}".` };
        if (!canWriteLoad(me, l)) return { content: "You cannot message on this load." };
        const text = String(input?.text || "").trim();
        if (!text) return { content: "Message text is empty." };
        addMessage(
          l.id,
          { authorId: me.id, authorName: me.name, authorRole: me.role, text, attachments: [] },
          me.id
        );
        return { content: `Message sent to ${l.driverName || l.driverEmail} on ${l.ref}.` };
      }
      case "navigate": {
        if (input?.loadRef) {
          const l = findLoad(me, input.loadRef);
          if (!l) return { content: `No load matching "${input.loadRef}".` };
          return {
            content: `Opening load ${l.ref}.`,
            action: { type: "navigate", href: `/loads/${l.id}` },
          };
        }
        const href = PAGES[String(input?.page || "")];
        if (!href) return { content: "Unknown page." };
        if (href === "/admin" && me.role !== "admin")
          return { content: "Admin area is not available for your account." };
        return { content: `Opening ${input.page}.`, action: { type: "navigate", href } };
      }
      default:
        return { content: `Unknown tool ${name}.` };
    }
  } catch (e) {
    return { content: `Tool error: ${(e as Error).message}` };
  }
}

function systemPrompt(me: User, path: string): string {
  return `You are the LoadSprint voice assistant for freight dispatchers and drivers.
The current user is "${me.name}", role: ${me.role}. They are on the page: ${path}.
You help them manage the site by talking. Rules:
- ALWAYS reply in the SAME language the user spoke (Russian or English). Answers are read aloud, so keep them short and natural — one or two sentences.
- Use the tools to look things up and to perform actions. Never invent load numbers, statuses or data — read them with a tool.
- To take the user to a page or a specific load, call the "navigate" tool.
- Before a destructive or hard-to-undo action (creating a load, changing status, messaging a driver), make sure the user gave the needed details; if something is missing, ask a short follow-up question instead of guessing.
- Respect roles: drivers can only see and update their own loads; only dispatchers/admin create loads or message drivers.
- Do not read out raw IDs or URLs; describe what you did in plain words.`;
}

async function callAnthropic(system: string, messages: any[]): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Sign in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ ok: false, error: "Assistant is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  const path = String(body?.path || "/");
  if (!message) return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });

  // Prior turns from the browser (plain text only), plus this message.
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const messages: any[] = history
    .filter((h: any) => (h?.role === "user" || h?.role === "assistant") && h?.text)
    .map((h: any) => ({ role: h.role, content: String(h.text) }));
  messages.push({ role: "user", content: message });

  const system = systemPrompt(me, path);
  let action: ClientAction | undefined;

  // Tool-use loop: let Claude read data / act, feed results back, until it answers.
  for (let step = 0; step < 6; step++) {
    const data = await callAnthropic(system, messages);
    if (!data || !Array.isArray(data.content))
      return NextResponse.json({ ok: false, error: "Assistant unavailable" }, { status: 502 });

    const toolUses = data.content.filter((c: any) => c.type === "tool_use");
    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = data.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join(" ")
        .trim();
      return NextResponse.json({ ok: true, text, action: action ?? null });
    }

    messages.push({ role: "assistant", content: data.content });
    const results = [];
    for (const tu of toolUses) {
      const r = await execTool(tu.name, tu.input || {}, me);
      if (r.action) action = r.action;
      results.push({ type: "tool_result", tool_use_id: tu.id, content: r.content });
    }
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({
    ok: true,
    text: "Готово.",
    action: action ?? null,
  });
}
