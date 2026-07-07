import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { createTicket, getTicketsByOwner, updateTicket } from "@/lib/support";
import { aiTriage, type Triage } from "@/lib/ai-support";
import { getLoadsByDispatcher } from "@/lib/loads";
import { getInvitesByRole } from "@/lib/invites";
import { sendEmail, supportTicketEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function accountContext(me: {
  id: string;
  role: string;
  tier?: string;
  tierExpiresAt?: string;
  company?: string;
}): string {
  const parts = [`role: ${me.role}`, `plan: ${me.tier || "none"}`];
  if (me.tierExpiresAt) parts.push(`plan expires: ${me.tierExpiresAt.slice(0, 10)}`);
  if (me.company) parts.push(`company: ${me.company}`);
  if (me.role === "dispatcher") {
    try {
      parts.push(`loads created: ${getLoadsByDispatcher(me.id).length}`);
      parts.push(`drivers invited: ${getInvitesByRole(me.id, "driver").length}`);
    } catch {
      /* ignore */
    }
  }
  return parts.join(", ");
}

// GET — the signed-in user's own tickets (internal AI fields stripped out).
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const tickets = getTicketsByOwner(me.id).map((t) => ({
    id: t.id,
    subject: t.subject,
    message: t.message,
    createdAt: t.createdAt,
    status: t.status,
    reply: t.reply || null,
    repliedAt: t.repliedAt || null,
  }));
  return NextResponse.json({ ok: true, tickets });
}

// POST — submit a support ticket. Claude triages it in the background (category,
// severity, internal report + a draft reply) for the admin to review.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const subject = typeof b?.subject === "string" ? b.subject.trim() : "";
  const message = typeof b?.message === "string" ? b.message.trim() : "";
  if (!subject || !message) {
    return NextResponse.json({ ok: false, error: "Add a subject and a message." }, { status: 400 });
  }

  const ticket = createTicket({
    ownerId: me.id,
    userName: me.name || me.email,
    userEmail: me.email,
    userRole: me.role,
    subject,
    message,
  });

  // Triage with Claude (best-effort — if the key is missing or it fails, the
  // ticket still lands in the admin inbox for manual handling).
  let triage: Triage | null = null;
  try {
    triage = await aiTriage(ticket, accountContext(me));
    if (triage) {
      updateTicket(ticket.id, {
        category: triage.category,
        severity: triage.severity,
        aiReport: triage.report,
        aiDraftReply: triage.draftReply,
        aiAt: new Date().toISOString(),
      });
    }
  } catch {
    /* triage is optional */
  }

  // Notify the admin by email (best-effort). Set SUPPORT_NOTIFY_EMAIL to control
  // the inbox; falls back to ADMIN_EMAIL. Skipped if Resend isn't configured.
  try {
    const to = process.env.SUPPORT_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || "admin@loadsprint.com";
    const origin = new URL(req.url).origin;
    const mail = supportTicketEmail({
      userName: ticket.userName,
      userEmail: ticket.userEmail,
      userRole: ticket.userRole,
      subject: ticket.subject,
      message: ticket.message,
      category: triage?.category,
      severity: triage?.severity,
      report: triage?.report,
      draftReply: triage?.draftReply,
      adminUrl: `${origin}/admin/support`,
    });
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
  } catch {
    /* notification is optional */
  }

  return NextResponse.json({ ok: true, id: ticket.id });
}
