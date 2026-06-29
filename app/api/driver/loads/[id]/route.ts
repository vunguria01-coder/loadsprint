import { NextResponse } from "next/server";
import { bearerUser, corsHeaders } from "@/lib/mobile-auth";
import {
  getLoadById,
  setStatus,
  addPhoto,
  addDocument,
  addMessage,
  markMessagesRead,
  LOAD_STATUSES,
  PHOTO_PHASES,
  DOC_TYPES,
  type Load,
  type LoadStatus,
  type PhotoPhase,
  type DocType,
} from "@/lib/loads";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

function mine(load: Load, email: string) {
  return load.driverEmail.toLowerCase() === email.toLowerCase();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = corsHeaders();
  const me = bearerUser(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401, headers: h });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load || !mine(load, me.email))
    return NextResponse.json({ ok: false }, { status: 404, headers: h });
  return NextResponse.json({ ok: true, load }, { headers: h });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = corsHeaders();
  const me = bearerUser(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401, headers: h });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load || !mine(load, me.email))
    return NextResponse.json({ ok: false }, { status: 404, headers: h });

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;
  let updated: Load | undefined;

  if (action === "status") {
    const status = body.status as LoadStatus;
    if (!LOAD_STATUSES.includes(status))
      return NextResponse.json({ ok: false }, { status: 400, headers: h });
    // Require proof of delivery before a load can be marked delivered.
    if (status === "Delivered") {
      const hasPod =
        (load.documents || []).some((d) => d.type === "pod") ||
        (load.photos || []).some((p) => p.phase === "at_delivery");
      if (!hasPod) {
        return NextResponse.json(
          { ok: false, error: "Add a proof-of-delivery photo before marking delivered." },
          { status: 400, headers: h }
        );
      }
    }
    if (status === "Closed") {
      return NextResponse.json(
        { ok: false, error: "Only the account owner can close a load." },
        { status: 403, headers: h }
      );
    }
    updated = setStatus(id, status, me.id);
  } else if (action === "photo") {
    const phase = body.phase as PhotoPhase;
    if (!PHOTO_PHASES.includes(phase) || !body.dataUrl)
      return NextResponse.json({ ok: false }, { status: 400, headers: h });
    updated = addPhoto(id, { phase, dataUrl: String(body.dataUrl), caption: String(body.caption || "") }, me.id);
  } else if (action === "document") {
    const type = body.docType as DocType;
    if (!DOC_TYPES.includes(type) || !body.dataUrl)
      return NextResponse.json({ ok: false }, { status: 400, headers: h });
    updated = addDocument(
      id,
      { type, name: String(body.name || "POD.jpg"), dataUrl: String(body.dataUrl), uploadedById: me.id, uploadedByName: me.name },
      me.id
    );
  } else if (action === "message") {
    updated = addMessage(
      id,
      { authorId: me.id, authorName: me.name, authorRole: "driver", text: String(body.text || ""), attachments: [] },
      me.id
    );
  } else if (action === "read") {
    markMessagesRead(id, me.id);
    updated = getLoadById(id);
  } else {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400, headers: h });
  }

  if (!updated) return NextResponse.json({ ok: false }, { status: 400, headers: h });
  return NextResponse.json({ ok: true, load: updated }, { headers: h });
}
