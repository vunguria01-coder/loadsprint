import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { generateConfirmationPdf, type ConfirmationData, type ConfirmationStop } from "@/lib/confirmation-pdf";

// POST /api/confirmation-pdf — build a clean rate-confirmation copy (PDF) from
// structured data and return it as a data URL.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  // Gated feature: admins, or dispatchers the admin has granted it to.
  const allowed = me.role === "admin" || (me.role === "dispatcher" && hasAccess(me) && !!me.canConfirmationPdf);
  if (!allowed) return NextResponse.json({ ok: false, error: "Not enabled for your account." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const stops = (v: unknown): ConfirmationStop[] =>
    Array.isArray(v)
      ? v
          .map((s) => ({
            address: String((s as Record<string, unknown>).address || "").trim(),
            time: (s as Record<string, unknown>).time ? String((s as Record<string, unknown>).time) : undefined,
          }))
          .filter((s) => s.address)
      : [];

  const data: ConfirmationData = {
    ref: b.ref ? String(b.ref).slice(0, 40) : undefined,
    rate: Number.isFinite(Number(b.rate)) ? Number(b.rate) : undefined,
    brokerName: b.brokerName ? String(b.brokerName).slice(0, 80) : undefined,
    brokerContact: b.brokerContact ? String(b.brokerContact).slice(0, 120) : undefined,
    billTo: b.billTo ? String(b.billTo).slice(0, 80) : undefined,
    carrierName: b.carrierName ? String(b.carrierName).slice(0, 80) : me.company || me.name,
    driverName: b.driverName ? String(b.driverName).slice(0, 60) : undefined,
    pickups: stops(b.pickups),
    dropoffs: stops(b.dropoffs),
    notes: b.notes ? String(b.notes).slice(0, 600) : undefined,
    dateLabel: b.dateLabel ? String(b.dateLabel).slice(0, 24) : undefined,
  };

  try {
    const dataUrl = await generateConfirmationPdf(data);
    return NextResponse.json({ ok: true, dataUrl });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not build the PDF." }, { status: 500 });
  }
}
