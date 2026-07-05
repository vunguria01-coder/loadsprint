import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { aiExtractRateCon, type AiScope } from "@/lib/ai-extract";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || (me.role !== "dispatcher" && me.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI not configured. Set ANTHROPIC_API_KEY on the server." },
      { status: 502 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text : "";
  const scope: AiScope =
    body?.scope === "addresses" || body?.scope === "addresses_rate"
      ? body.scope
      : "all";
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "No text" }, { status: 400 });
  }
  const result = await aiExtractRateCon(text, scope);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Could not read this document." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, result });
}
