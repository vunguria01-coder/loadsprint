import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";
import { getInvoiceProfile } from "@/lib/invoice-profile";
import { buildInvoiceDraft, invoiceTotals } from "@/lib/invoice-build";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

// GET /api/loads/[id]/package
// Returns everything needed to build the broker package on the client:
//   - confirmation (the rate-confirmation document uploaded at creation)
//   - photos (the load photos)
//   - invoice (the one already saved on the load, or a fresh draft rendered now)
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

  // Prefer the invoice the dispatcher already created — the broker should get
  // exactly the document that was saved on the load. If there isn't one yet,
  // render the draft so the package is never missing an invoice.
  let invoice: { number: string; total: number; dataUrl: string; saved: boolean } | null = null;
  const savedDoc = load.documents.find((d) => d.type === "invoice_broker");
  if (savedDoc) {
    invoice = {
      number: load.brokerInvoice?.number || savedDoc.name.replace(/^Invoice\s*|\.pdf$/gi, ""),
      total: load.brokerInvoice?.amount ?? load.loadRate ?? 0,
      dataUrl: savedDoc.dataUrl,
      saved: true,
    };
  } else {
    try {
      const draft = buildInvoiceDraft(load, getInvoiceProfile(me.id));
      invoice = {
        number: draft.invoiceNumber,
        total: invoiceTotals(draft).total,
        dataUrl: await generateInvoicePdf(draft),
        saved: false,
      };
    } catch {
      invoice = null; // the package still builds without it
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
