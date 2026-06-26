import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { aiGenerateInvoice } from "@/lib/ai-invoice";

// POST /api/loads/[id]/invoice → AI-generated invoice JSON for a finished load.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (me.role === "dispatcher" && load.dispatcherId !== me.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const invoice = await aiGenerateInvoice({
    ref: load.ref,
    originName: load.originName,
    destName: load.destName,
    rate: load.loadRate,
    stops: load.stops?.map((s) => ({ kind: s.kind, address: s.address })),
    driverName: load.driverName,
  });
  if (!invoice) {
    return NextResponse.json({ ok: false, error: "Could not build the invoice." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, invoice });
}
