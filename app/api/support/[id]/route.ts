import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getTicket, updateTicket, type TicketStatus } from "@/lib/support";
import { aiTriage } from "@/lib/ai-support";
import { findByEmail } from "@/lib/auth";
import { getLoadsByDispatcher } from "@/lib/loads";
import { getInvitesByRole } from "@/lib/invites";

export const dynamic = "force-dynamic";

// POST /api/support/[id] — admin actions: send a reply, change status, or re-run
// the AI triage.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const ticket = getTicket(id);
  if (!ticket) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const action = b?.action;

  if (action === "reply") {
    const reply = typeof b?.reply === "string" ? b.reply.trim() : "";
    if (!reply) return NextResponse.json({ ok: false, error: "Empty reply" }, { status: 400 });
    const t = updateTicket(id, {
      reply: reply.slice(0, 4000),
      repliedAt: new Date().toISOString(),
      repliedBy: me.name || me.email,
      status: "answered",
    });
    return NextResponse.json({ ok: true, ticket: t });
  }

  if (action === "status") {
    const status = b?.status as TicketStatus;
    if (!["new", "answered", "resolved"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Bad status" }, { status: 400 });
    }
    const t = updateTicket(id, { status });
    return NextResponse.json({ ok: true, ticket: t });
  }

  if (action === "retriage") {
    const owner = findByEmail(ticket.userEmail);
    const ctx: string[] = [`role: ${ticket.userRole}`];
    if (owner) {
      if (owner.tier) ctx.push(`plan: ${owner.tier}`);
      if (owner.company) ctx.push(`company: ${owner.company}`);
      if (ticket.userRole === "dispatcher") {
        try {
          ctx.push(`loads created: ${getLoadsByDispatcher(owner.id).length}`);
          ctx.push(`drivers invited: ${getInvitesByRole(owner.id, "driver").length}`);
        } catch {
          /* ignore */
        }
      }
    }
    const triage = await aiTriage(ticket, ctx.join(", "));
    if (!triage) return NextResponse.json({ ok: false, error: "AI unavailable" }, { status: 502 });
    const t = updateTicket(id, {
      category: triage.category,
      severity: triage.severity,
      aiReport: triage.report,
      aiDraftReply: triage.draftReply,
      aiAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, ticket: t });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
