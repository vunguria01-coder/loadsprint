import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { aiExtractRateConPdf, type AiScope } from "@/lib/ai-extract";

// Reads a rate confirmation that has no text layer (a scan or a photo-to-PDF)
// by handing the PDF itself to Claude instead of extracted text.
const MAX_BYTES = 10 * 1024 * 1024;

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
  const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
  const scope: AiScope =
    body?.scope === "addresses" || body?.scope === "addresses_rate" ? body.scope : "all";

  const match = /^data:application\/pdf;base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ ok: false, error: "Not a PDF file." }, { status: 400 });
  }
  const base64 = match[1];
  // base64 inflates by ~4/3; check the decoded size against the cap.
  if ((base64.length * 3) / 4 > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "This PDF is too large to read (over 10 MB)." },
      { status: 413 }
    );
  }

  const result = await aiExtractRateConPdf(base64, scope);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Could not read this document." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, result });
}
