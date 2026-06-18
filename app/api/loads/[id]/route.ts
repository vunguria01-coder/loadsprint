import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import type { User } from "@/lib/auth";
import {
  getLoadById,
  advanceLocation,
  currentPoint,
  setStatus,
  setHold,
  addDocument,
  addPhoto,
  addMessage,
  markMessagesRead,
  setInternalLocation,
  setShareLocationWithBroker,
  sendDocumentToDriver,
  setBrokerInfo,
  LOAD_STATUSES,
  DOC_TYPES,
  PHOTO_PHASES,
  type Load,
  type LoadStatus,
  type DocType,
  type PhotoPhase,
} from "@/lib/loads";

function canAccess(load: Load, user: User) {
  if (user.role === "admin") return true;
  if (user.role === "dispatcher" && load.dispatcherId === user.id) return true;
  if (user.role === "broker" && load.brokerEmail.toLowerCase() === user.email) return true;
  if (load.driverEmail.toLowerCase() === user.email) return true;
  return false;
}

function serialize(load: Load, user: User) {
  const base: Record<string, unknown> = {
    ...load,
    point: currentPoint(load),
    canHold: user.canFreezeLocation === true,
    youId: user.id,
    youRole: user.role,
  };
  // The internal working location is for dispatcher/driver only — never a broker.
  if (user.role === "broker") {
    delete base.internalPoint;
    delete base.internalUpdatedAt;
    delete base.heldPoint;
    delete base.sharePausedPoint;
    if (load.shareLocationWithBroker === false) {
      // Honest paused state: hold at the last shared point, label it clearly.
      base.point = load.sharePausedPoint ?? currentPoint(load);
      base.locationUpdatedAt = load.sharePausedAt ?? load.locationUpdatedAt;
      base.brokerPaused = true;
      base.brokerPausedLabel = "Location sharing paused by dispatcher";
    } else if (load.held) {
      base.brokerPaused = true;
      base.brokerPausedLabel = "Parked at rest stop";
    }
  }
  return base;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  if (searchParams.get("advance") === "1") advanceLocation(id);
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!canAccess(load, me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, load: serialize(load, me) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!canAccess(load, me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;
  let updated: Load | undefined;

  switch (action) {
    case "status": {
      const status = body.status as LoadStatus;
      if (!LOAD_STATUSES.includes(status))
        return NextResponse.json({ ok: false, error: "Bad status" }, { status: 400 });
      updated = setStatus(id, status, me.id);
      break;
    }
    case "hold": {
      if (!me.canFreezeLocation)
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = setHold(id, !!body.held);
      break;
    }
    case "internal": {
      if (me.role === "broker")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return NextResponse.json({ ok: false, error: "Bad coords" }, { status: 400 });
      updated = setInternalLocation(id, { lat, lng });
      break;
    }
    case "share": {
      if (me.role === "broker")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = setShareLocationWithBroker(id, !!body.value);
      break;
    }
    case "broker_info": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = setBrokerInfo(id, {
        name: body.name !== undefined ? String(body.name) : undefined,
        email: body.email !== undefined ? String(body.email) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
      });
      break;
    }
    case "send_doc": {
      if (me.role === "broker")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = sendDocumentToDriver(id, String(body.docId), {
        id: me.id,
        name: me.name,
        role: me.role,
      });
      break;
    }
    case "document": {
      const type = body.docType as DocType;
      if (!DOC_TYPES.includes(type) || !body.dataUrl || !body.name)
        return NextResponse.json({ ok: false, error: "Bad document" }, { status: 400 });
      updated = addDocument(
        id,
        {
          type,
          name: String(body.name).slice(0, 120),
          dataUrl: String(body.dataUrl),
          uploadedById: me.id,
          uploadedByName: me.name,
        },
        me.id
      );
      break;
    }
    case "photo": {
      const phase = body.phase as PhotoPhase;
      if (!PHOTO_PHASES.includes(phase) || !body.dataUrl)
        return NextResponse.json({ ok: false, error: "Bad photo" }, { status: 400 });
      updated = addPhoto(
        id,
        { phase, dataUrl: String(body.dataUrl), caption: String(body.caption || "") },
        me.id
      );
      break;
    }
    case "message": {
      const text = String(body.text || "").slice(0, 2000);
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      if (!text && attachments.length === 0)
        return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
      updated = addMessage(
        id,
        {
          authorId: me.id,
          authorName: me.name,
          authorRole: me.role,
          text,
          attachments,
        },
        me.id
      );
      break;
    }
    case "read": {
      markMessagesRead(id, me.id);
      updated = getLoadById(id);
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  if (!updated) return NextResponse.json({ ok: false, error: "Failed" }, { status: 400 });
  return NextResponse.json({ ok: true, load: serialize(updated, me) });
}
