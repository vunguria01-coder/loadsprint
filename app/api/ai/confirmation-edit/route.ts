import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { aiEditConfirmation } from "@/lib/ai-confirmation-edit";
import type { ConfirmationData } from "@/lib/confirmation-pdf";

// POST /api/ai/confirmation-edit { data, instruction } — apply a natural-language
// edit to the confirmation copy's fields via Claude.
export async function POST(req: Request) {
  const me = await currentUser();
  // Gated feature: admins, or dispatchers the admin has granted it to.
  const allowed = me && (me.role === "admin" || (me.role === "dispatcher" && me.canConfirmationPdf));
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Not enabled for your account." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI not configured. Set ANTHROPIC_API_KEY on the server." },
      { status: 502 }
    );
  }
  const b = await req.json().catch(() => ({}));
  const instruction = typeof b?.instruction === "string" ? b.instruction : "";
  const data = (b?.data || {}) as ConfirmationData;
  if (!instruction.trim()) {
    return NextResponse.json({ ok: false, error: "Tell the AI what to change." }, { status: 400 });
  }
  const result = await aiEditConfirmation(data, instruction);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Couldn't apply that edit." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, result });
}
