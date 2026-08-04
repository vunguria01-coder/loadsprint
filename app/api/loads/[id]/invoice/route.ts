import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById, saveBrokerInvoiceDoc, setInvoice, type Load } from "@/lib/loads";
import type { User } from "@/lib/auth";
import { allocateInvoiceNumber, getInvoiceProfile } from "@/lib/invoice-profile";
import { buildInvoiceDraft, invoiceTotals, sanitizeInvoice } from "@/lib/invoice-build";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

type Auth =
  | { error: NextResponse; me?: undefined; load?: undefined }
  | { error?: undefined; me: User; load: Load };

async function authorize(id: string): Promise<Auth> {
  const me = await currentUser();
  if (!me || (me.role !== "dispatcher" && me.role !== "admin")) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const load = getLoadById(id);
  if (!load) {
    return { error: NextResponse.json({ ok: false, error: "Not found" }, { status: 404 }) };
  }
  if (me.role === "dispatcher" && load.dispatcherId !== me.id) {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { me, load };
}

// GET /api/loads/[id]/invoice → the invoice draft, built from the load itself.
// No AI and no API key involved: the numbers come from the load and the header
// from the dispatcher's saved company profile.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error) return auth.error;

  const profile = getInvoiceProfile(auth.me.id);
  return NextResponse.json({
    ok: true,
    invoice: buildInvoiceDraft(auth.load, profile),
  });
}

// POST /api/loads/[id]/invoice → allocate the number, render the PDF server-side
// and store it on the load, so it ships with the final documents to the broker.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error) return auth.error;

  const profile = getInvoiceProfile(auth.me.id);
  const body = await req.json().catch(() => ({}));
  const draft = buildInvoiceDraft(auth.load, profile);
  const invoice = sanitizeInvoice(body?.invoice, draft);

  // A number the dispatcher typed wins; otherwise take the next one in sequence.
  const typed = Number(invoice.invoiceNumber);
  const number = allocateInvoiceNumber(
    auth.me.id,
    Number.isFinite(typed) && typed > 0 ? typed : undefined
  );
  invoice.invoiceNumber = /^\d+$/.test(invoice.invoiceNumber.trim())
    ? String(number)
    : invoice.invoiceNumber.trim() || String(number);

  let dataUrl: string;
  try {
    dataUrl = await generateInvoicePdf(invoice);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not render the invoice PDF." },
      { status: 500 }
    );
  }

  const totals = invoiceTotals(invoice);
  saveBrokerInvoiceDoc(
    id,
    { name: `Invoice ${invoice.invoiceNumber}.pdf`, dataUrl },
    { id: auth.me.id, name: auth.me.name }
  );
  setInvoice(
    id,
    "broker",
    {
      amount: totals.total,
      number: invoice.invoiceNumber,
      notes: `Invoice ${invoice.invoiceNumber}`,
    },
    auth.me.name
  );

  return NextResponse.json({ ok: true, invoice, totals, dataUrl });
}
