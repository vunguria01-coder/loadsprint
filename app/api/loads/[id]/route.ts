import { NextResponse } from "next/server";
import { requestUser } from "@/lib/guard";
import { corsHeaders } from "@/lib/mobile-auth";
import { truckRoute, geocodeHere } from "@/lib/here";
import { findByEmail, getUserById } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { deleteLoad } from "@/lib/loads";
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
  setDriverLocation,
  setDriverShareLocation,
  setLoadEta,
  setLoadGeo,
  setLoadAddresses,
  toggleStopDone,
  etaIsStale,
  setShareLocationWithBroker,
  sendDocumentToDriver,
  setBrokerInfo,
  setInvoice,
  markInvoiceSent,
  ensureBrokerShare,
  setPhotoBrokerVisible,
  publishToBroker,
  pushNotification,
  LOAD_STATUSES,
  DOC_TYPES,
  PHOTO_PHASES,
  type Load,
  type LoadStatus,
  type DocType,
  type PhotoPhase,
} from "@/lib/loads";

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

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
    dispatcherName: load.dispatcherName || getUserById(load.dispatcherId)?.name || "",
    point: currentPoint(load),
    canHold: user.canFreezeLocation === true,
    youId: user.id,
    youRole: user.role,
    youIsOwner:
      user.role === "admin" ||
      (user.role === "dispatcher" && !user.ownerId),
  };
  // The internal working location is for dispatcher/driver only — never a broker.
  if (user.role === "broker") {
    delete base.internalPoint;
    delete base.internalUpdatedAt;
    delete base.heldPoint;
    delete base.sharePausedPoint;
    delete base.driverPoint;
    delete base.driverSharePausedPoint;
    // The driver-pay invoice is internal — never shown to a broker.
    delete base.driverInvoice;
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
  } else {
    // Dispatcher / driver: surface the driver's own sharing state for the UI.
    if (load.driverShareLocation === false) {
      base.driverPaused = true;
      base.driverLocationAt = load.driverSharePausedAt ?? load.driverLocationAt;
    }
  }
  // A driver doesn't need the broker-billing invoice.
  if (user.role === "driver") {
    delete base.brokerInvoice;
  }
  return base;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requestUser(req);
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
  const me = await requestUser(req);
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let load = getLoadById(id);
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

      // Anti-fake guard (admins exempt): a load may only become "Delivered" via
      // the assigned driver, and only with proof of delivery (a POD document or
      // an at-delivery photo). "Closed" must come from a delivered load. This
      // stops a dispatcher from pushing a fabricated load into completed/history.
      if (me.role !== "admin") {
        if (status === "Delivered") {
          const isAssignedDriver =
            load.driverEmail.toLowerCase() === me.email.toLowerCase();
          if (!isAssignedDriver) {
            return NextResponse.json(
              { ok: false, error: "Only the assigned driver can mark a load delivered." },
              { status: 403 }
            );
          }
          const hasPod =
            (load.documents || []).some((d) => d.type === "pod") ||
            (load.photos || []).some((p) => p.phase === "at_delivery");
          if (!hasPod) {
            return NextResponse.json(
              { ok: false, error: "Add a proof-of-delivery photo before marking delivered." },
              { status: 400 }
            );
          }
        }
        if (status === "Closed") {
          // Only the account OWNER (or admin) may close a load — a sub-dispatcher
          // (one with an ownerId) cannot. Closing must come from a delivered load.
          if (me.role === "dispatcher" && me.ownerId) {
            return NextResponse.json(
              { ok: false, error: "Only the account owner can close a load." },
              { status: 403 }
            );
          }
          if (load.status !== "Delivered") {
            return NextResponse.json(
              { ok: false, error: "A load must be delivered before it can be closed." },
              { status: 400 }
            );
          }
        }
      }

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
    case "driver_location": {
      // Only the driver assigned to this load may report GPS.
      if (load.driverEmail.toLowerCase() !== me.email.toLowerCase())
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return NextResponse.json({ ok: false, error: "Bad coords" }, { status: 400 });
      updated = setDriverLocation(id, { lat, lng });
      // Throttled truck-route ETA refresh as the driver moves.
      if (updated && updated.driverShareLocation !== false && updated.driverPoint && etaIsStale(updated)) {
        const r = await truckRoute(updated.driverPoint, updated.dest);
        if (r) updated = setLoadEta(id, r.distanceMeters, r.durationSeconds) ?? updated;
      }
      break;
    }
    case "stop_done": {
      // Driver checks a stop off (or un-checks it).
      if (load.driverEmail.toLowerCase() !== me.email.toLowerCase())
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      const stopId = String(body.stopId || "");
      const done = body.done !== false;
      updated = toggleStopDone(id, stopId, done);
      break;
    }
    case "route": {
      // Driver asks for a fresh truck route to a target stop (with turn-by-turn).
      if (load.driverEmail.toLowerCase() !== me.email.toLowerCase())
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      if (!process.env.HERE_API_KEY)
        return NextResponse.json(
          { ok: false, error: "Routing unavailable. Set HERE_API_KEY on the server." },
          { status: 502 }
        );
      const target = body.to === "pickup" ? "pickup" : "delivery";
      // Resolve precise coordinates from the typed addresses (HERE geocoding),
      // persist them, and use them — so any street address works.
      const [geoOrigin, geoDest] = await Promise.all([
        geocodeHere(load.originName),
        geocodeHere(load.destName),
      ]);
      if (geoOrigin || geoDest) {
        const upd = setLoadGeo(id, geoOrigin ?? undefined, geoDest ?? undefined);
        if (upd) load = upd;
      }
      // Start from live GPS if we have it, otherwise the load's pickup point.
      const from = load.driverPoint ?? load.origin;
      // If a specific stop is requested, route to that stop's coordinate.
      let dest = target === "pickup" ? load.origin : load.dest;
      const stopId = body.stopId ? String(body.stopId) : "";
      if (stopId && load.stops) {
        const st = load.stops.find((x) => x.id === stopId);
        if (st) {
          dest = st.point ?? (await geocodeHere(st.address)) ?? dest;
        }
      }
      const r = await truckRoute(from, dest, { withSteps: true, truck: body.truck });
      if (!r)
        return NextResponse.json(
          {
            ok: false,
            error: "Could not build a route. Check the pickup/delivery addresses on this load.",
          },
          { status: 502 }
        );
      // Only the delivery ETA is stored on the load (that's what the board shows).
      if (target === "delivery") setLoadEta(id, r.distanceMeters, r.durationSeconds);
      const fresh = getLoadById(id);
      return NextResponse.json({
        ok: true,
        route: r,
        target,
        from,
        dest,
        load: fresh ? serialize(fresh, me) : null,
      });
    }
    case "driver_share": {
      // Only the assigned driver toggles their own location sharing.
      if (load.driverEmail.toLowerCase() !== me.email.toLowerCase())
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = setDriverShareLocation(id, !!body.value);
      break;
    }
    case "share": {
      if (me.role === "broker")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = setShareLocationWithBroker(id, !!body.value);
      break;
    }
    case "addresses": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      const originName = body.originName !== undefined ? String(body.originName) : undefined;
      const destName = body.destName !== undefined ? String(body.destName) : undefined;
      updated = setLoadAddresses(id, originName, destName);
      // Re-geocode the new addresses so the map, routing and ETA stay correct.
      if (updated) {
        const [go, gd] = await Promise.all([
          originName ? geocodeHere(updated.originName) : Promise.resolve(null),
          destName ? geocodeHere(updated.destName) : Promise.resolve(null),
        ]);
        if (go || gd) updated = setLoadGeo(id, go ?? undefined, gd ?? undefined) ?? updated;
      }
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
    case "broker_share": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = ensureBrokerShare(id);
      break;
    }
    case "broker_photo": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = setPhotoBrokerVisible(id, String(body.photoId || ""), !!body.visible);
      break;
    }
    case "broker_publish": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      updated = publishToBroker(id);
      break;
    }
    case "invoice_set": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      const kind = body.kind === "driver" ? "driver" : "broker";
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0)
        return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
      updated = setInvoice(
        id,
        kind,
        {
          amount,
          notes: String(body.notes || ""),
          currency: String(body.currency || "$"),
          gross: Number(body.gross) >= 0 && body.gross !== undefined ? Number(body.gross) : undefined,
          commissionType: body.commissionType === "amt" ? "amt" : body.commissionType === "pct" ? "pct" : undefined,
          commissionValue:
            body.commissionValue !== undefined && Number(body.commissionValue) >= 0
              ? Number(body.commissionValue)
              : undefined,
        },
        me.name
      );
      break;
    }
    case "invoice_sent": {
      if (me.role !== "dispatcher" && me.role !== "admin")
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      const kind = body.kind === "driver" ? "driver" : "broker";
      updated = markInvoiceSent(id, kind, me.name);
      if (updated) {
        if (kind === "driver" && updated.driverInvoice) {
          const driver = findByEmail(updated.driverEmail);
          if (driver)
            pushNotification(
              driver.id,
              `Invoice ${updated.driverInvoice.number}: ${updated.driverInvoice.currency}${updated.driverInvoice.amount} sent to you.`,
              updated
            );
        } else if (kind === "broker" && updated.brokerInvoice) {
          const broker = findByEmail(updated.brokerEmail);
          if (broker)
            pushNotification(
              broker.id,
              `Invoice ${updated.brokerInvoice.number} received: ${updated.brokerInvoice.currency}${updated.brokerInvoice.amount}`,
              updated
            );
          // External brokers (no account) receive it by email — simulated for now.
        }
      }
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requestUser(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  if (me.role !== "dispatcher" && me.role !== "admin")
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const ok = deleteLoad(id, me.id, me.role === "admin");
  if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: true });
}
