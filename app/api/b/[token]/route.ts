import { NextResponse } from "next/server";
import { getLoadByToken, currentPoint, type Load } from "@/lib/loads";

// Public broker portal API. No login — access is gated by the share code.
// POST /api/b/[token]  body: { code: string, full?: boolean }
//   full=true  -> returns everything (confirmation, photos, documents)
//   otherwise  -> light poll payload (status + location only)

function brokerPoint(load: Load) {
  // Honour the dispatcher's sharing controls, same as the broker web view.
  if (load.shareLocationWithBroker === false) {
    return {
      point: load.sharePausedPoint ?? currentPoint(load),
      at: load.sharePausedAt ?? load.locationUpdatedAt,
      paused: true,
      pausedLabel: "Location sharing paused by dispatcher",
    };
  }
  if (load.held) {
    return {
      point: currentPoint(load),
      at: load.locationUpdatedAt,
      paused: true,
      pausedLabel: "Parked at rest stop",
    };
  }
  return { point: currentPoint(load), at: load.locationUpdatedAt, paused: false, pausedLabel: "" };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const load = getLoadByToken(token);
  // Generic 404 so probing tokens reveals nothing.
  if (!load || !load.shareToken) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  if (!load.shareCode || code !== load.shareCode) {
    return NextResponse.json({ ok: false, error: "Wrong code" }, { status: 401 });
  }

  const loc = brokerPoint(load);
  const published = !!load.brokerPublished;

  // Light poll payload (status + location), always returned.
  const light = {
    ok: true,
    ref: load.ref,
    status: load.status,
    progress: load.progress,
    originName: load.originName,
    destName: load.destName,
    point: loc.point,
    locationUpdatedAt: loc.at,
    paused: loc.paused,
    pausedLabel: loc.pausedLabel,
    published,
  };

  if (!body.full) {
    return NextResponse.json(light);
  }

  // Full payload: confirmation, broker-visible photos, and (if published) docs.
  const confDoc =
    (load.documents || []).find((d) => d.type === "rate_confirmation") || null;
  const confirmation = confDoc
    ? { name: confDoc.name || "rate-confirmation", dataUrl: confDoc.dataUrl }
    : null;

  const photos = (load.photos || [])
    .filter((p) => p.brokerVisible)
    .map((p) => ({ id: p.id, caption: p.caption || "", dataUrl: p.dataUrl }));

  // Final documents only after the dispatcher publishes. Never expose the
  // internal driver-pay invoice or the rate con (shown separately).
  const documents = published
    ? (load.documents || [])
        .filter((d) => d.type !== "invoice_driver" && d.type !== "rate_confirmation")
        .map((d) => ({ name: d.name || d.type, type: d.type, dataUrl: d.dataUrl }))
    : [];

  const invoice = published ? load.brokerInvoice ?? null : null;

  return NextResponse.json({
    ...light,
    driverName: load.driverName,
    confirmation,
    photos,
    documents,
    invoice,
  });
}
