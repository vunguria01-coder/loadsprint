import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { getInvoiceProfile } from "@/lib/invoice-profile";
import { aiGenerateInvoice } from "@/lib/ai-invoice";

// GET /api/loads/[id]/package
// Returns everything needed to build the broker package on the client:
//   - confirmation (the rate-confirmation document uploaded at creation)
//   - photos (the load photos)
//   - invoice (AI-generated, price taken from the rate con)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me || (me.role !== "dispatcher" && me.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (me.role === "dispatcher" && load.dispatcherId !== me.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Confirmation = the rate_confirmation document (never the driver rate sheet).
  const conf =
    load.documents.find((d) => d.type === "rate_confirmation") ||
    load.documents.find((d) => d.type !== "driver_rate_sheet") ||
    null;

  const photos = load.photos.map((p, i) => ({
    name: `photo-${i + 1}${p.dataUrl.includes("image/png") ? ".png" : ".jpg"}`,
    dataUrl: p.dataUrl,
  }));

  // Invoice (best-effort — package still builds if AI is unavailable).
  let invoice = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const company = getInvoiceProfile(me.id);
      invoice = await aiGenerateInvoice({
        ref: load.ref,
        originName: load.originName,
        destName: load.destName,
        rate: load.loadRate,
        stops: load.stops?.map((s) => ({ kind: s.kind, address: s.address })),
        driverName: load.driverName,
        billTo: load.billTo,
        company,
      });
    } catch {
      invoice = null;
    }
  }

  return NextResponse.json({
    ok: true,
    ref: load.ref,
    driverName: load.driverName || load.driverEmail || "",
    rate: load.loadRate ?? null,
    confirmation: conf ? { name: conf.name || "confirmation", dataUrl: conf.dataUrl } : null,
    photos,
    invoice,
  });
}
