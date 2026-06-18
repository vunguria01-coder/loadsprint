import crypto from "crypto";
import fs from "fs";
import path from "path";
import { findByEmail, getUserById } from "@/lib/auth";

const DATA_DIR = path.join(process.cwd(), "data");
const LOADS_FILE = path.join(DATA_DIR, "loads.json");
const NOTIFS_FILE = path.join(DATA_DIR, "notifications.json");

export const LOAD_STATUSES = [
  "Assigned",
  "Picked Up",
  "In Transit",
  "At Delivery",
  "Delivered",
  "Closed",
] as const;
export type LoadStatus = (typeof LOAD_STATUSES)[number];

export const DOC_TYPES = [
  "rate_confirmation",
  "bol",
  "pod",
  "attachment",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const PHOTO_PHASES = ["before_pickup", "in_transit", "at_delivery"] as const;
export type PhotoPhase = (typeof PHOTO_PHASES)[number];

export type GeoPoint = { lat: number; lng: number };

export type LoadDocument = {
  id: string;
  type: DocType;
  name: string;
  dataUrl: string;
  uploadedById: string;
  uploadedByName: string;
  uploadedAt: string;
};

export type LoadPhoto = {
  id: string;
  phase: PhotoPhase;
  dataUrl: string;
  caption: string;
  uploadedAt: string;
};

export type ChatAttachment = { name: string; dataUrl: string; kind: "image" | "pdf" | "file" };

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  text: string;
  attachments: ChatAttachment[];
  createdAt: string;
  readBy: string[];
};

export type Load = {
  id: string;
  ref: string;
  dispatcherId: string;
  driverName: string;
  driverEmail: string;
  brokerName: string;
  brokerEmail: string;
  brokerPhone: string;
  hasBroker: boolean; // true only when a broker exists in the system for this load
  shareLocationWithBroker: boolean; // dispatcher-controlled
  sharePausedPoint?: GeoPoint;
  sharePausedAt?: string;
  originName: string;
  destName: string;
  origin: GeoPoint;
  dest: GeoPoint;
  progress: number; // 0..1 along origin->dest
  locationUpdatedAt: string;
  held: boolean; // privacy hold: keep marker at real parked point, stop broadcasting driver movement
  heldPoint?: GeoPoint;
  heldAt?: string;
  // Internal-only location layer for dispatcher + driver. NEVER serialized to a broker.
  internalPoint?: GeoPoint;
  internalUpdatedAt?: string;
  status: LoadStatus;
  documents: LoadDocument[];
  photos: LoadPhoto[];
  messages: ChatMessage[];
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  text: string;
  loadId: string;
  loadRef: string;
  createdAt: string;
  read: boolean;
};

/* ---------- file helpers ---------- */
function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOADS_FILE)) fs.writeFileSync(LOADS_FILE, "[]", "utf8");
  if (!fs.existsSync(NOTIFS_FILE)) fs.writeFileSync(NOTIFS_FILE, "[]", "utf8");
}
function readLoads(): Load[] {
  ensure();
  try {
    const loads = JSON.parse(fs.readFileSync(LOADS_FILE, "utf8")) as Load[];
    // hasBroker reflects whether a broker account actually exists in the system
    return loads.map((l) => ({
      ...l,
      brokerPhone: l.brokerPhone ?? "",
      shareLocationWithBroker: l.shareLocationWithBroker ?? true,
      hasBroker: !!l.brokerEmail && !!findByEmail(l.brokerEmail),
    }));
  } catch {
    return [];
  }
}
function writeLoads(loads: Load[]) {
  ensure();
  fs.writeFileSync(LOADS_FILE, JSON.stringify(loads, null, 2), "utf8");
}
function readNotifs(): Notification[] {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(NOTIFS_FILE, "utf8")) as Notification[];
  } catch {
    return [];
  }
}
function writeNotifs(n: Notification[]) {
  ensure();
  fs.writeFileSync(NOTIFS_FILE, JSON.stringify(n, null, 2), "utf8");
}

/* ---------- geo / location ---------- */
export function currentPoint(load: Load): GeoPoint {
  // While held, show the real parked position captured when the hold started.
  if (load.held && load.heldPoint) return load.heldPoint;
  return {
    lat: load.origin.lat + (load.dest.lat - load.origin.lat) * load.progress,
    lng: load.origin.lng + (load.dest.lng - load.origin.lng) * load.progress,
  };
}

// Simulate a live GPS ping by advancing the driver along the route.
// A real driver app would POST actual coordinates instead.
export function advanceLocation(loadId: string): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  const l = loads[i];
  if (
    !l.held &&
    l.progress < 1 &&
    l.status !== "Delivered" &&
    l.status !== "Closed"
  ) {
    l.progress = Math.min(1, l.progress + 0.03);
    l.locationUpdatedAt = new Date().toISOString();
    writeLoads(loads);
  }
  return l;
}

// Internal location layer: dispatcher/driver may set or move this freely.
// It is a private working marker and is stripped from any broker response.
export function setInternalLocation(
  loadId: string,
  point: GeoPoint
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].internalPoint = point;
  loads[i].internalUpdatedAt = new Date().toISOString();
  writeLoads(loads);
  return loads[i];
}

// Dispatcher sets/updates broker contact (works for external brokers not on the platform).
export function setBrokerInfo(
  loadId: string,
  info: { name?: string; email?: string; phone?: string }
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  if (info.name !== undefined) loads[i].brokerName = info.name;
  if (info.email !== undefined) loads[i].brokerEmail = info.email.trim().toLowerCase();
  if (info.phone !== undefined) loads[i].brokerPhone = info.phone;
  writeLoads(loads);
  return loads[i];
}

// Dispatcher controls whether the broker sees live location. When turned off,
// the broker sees an honest "paused" status frozen at the last shared point.
export function setShareLocationWithBroker(
  loadId: string,
  value: boolean
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].shareLocationWithBroker = value;
  if (!value) {
    loads[i].sharePausedPoint = currentPoint(loads[i]);
    loads[i].sharePausedAt = new Date().toISOString();
  } else {
    loads[i].sharePausedPoint = undefined;
    loads[i].sharePausedAt = undefined;
  }
  writeLoads(loads);
  return loads[i];
}

// Attach an existing document to the load chat (e.g. forward a Rate Con to the driver).
export function sendDocumentToDriver(
  loadId: string,
  docId: string,
  actor: { id: string; name: string; role: string }
): Load | undefined {
  const load = getLoadById(loadId);
  if (!load) return undefined;
  const doc = load.documents.find((d) => d.id === docId);
  if (!doc) return undefined;
  const kind: ChatAttachment["kind"] = doc.dataUrl.startsWith("data:application/pdf")
    ? "pdf"
    : doc.dataUrl.startsWith("data:image")
    ? "image"
    : "file";
  return addMessage(
    loadId,
    {
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      text: `📄 ${doc.name} sent to driver`,
      attachments: [{ name: doc.name, dataUrl: doc.dataUrl, kind }],
    },
    actor.id
  );
}

// Privacy hold: freeze the displayed marker at the trailer's real current point
// (e.g. a truck stop) so the driver's personal movements aren't broadcast.
// This does NOT move the marker anywhere — it holds the genuine last position.
export function setHold(loadId: string, held: boolean): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  const l = loads[i];
  if (held) {
    l.held = true;
    l.heldPoint = currentPoint(l);
    l.heldAt = new Date().toISOString();
  } else {
    l.held = false;
    l.heldPoint = undefined;
    l.heldAt = undefined;
  }
  writeLoads(loads);
  return l;
}

/* ---------- notifications ---------- */
export function pushNotification(
  userId: string | undefined,
  text: string,
  load: Load
) {
  if (!userId) return;
  const n = readNotifs();
  n.push({
    id: crypto.randomUUID(),
    userId,
    text,
    loadId: load.id,
    loadRef: load.ref,
    createdAt: new Date().toISOString(),
    read: false,
  });
  writeNotifs(n);
}

function notifyParties(load: Load, actorId: string, text: string) {
  const broker = findByEmail(load.brokerEmail);
  const recipients = new Set<string>();
  recipients.add(load.dispatcherId);
  if (broker) recipients.add(broker.id);
  recipients.delete(actorId);
  recipients.forEach((uid) => pushNotification(uid, text, load));
}

export function getNotifications(userId: string): Notification[] {
  return readNotifs()
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export function markNotificationsRead(userId: string) {
  const n = readNotifs();
  let changed = false;
  for (const item of n) {
    if (item.userId === userId && !item.read) {
      item.read = true;
      changed = true;
    }
  }
  if (changed) writeNotifs(n);
}

/* ---------- queries ---------- */
export function getAllLoads(): Load[] {
  return readLoads();
}
export function getLoadById(id: string): Load | undefined {
  return readLoads().find((l) => l.id === id);
}
export function getLoadsByDispatcher(dispatcherId: string): Load[] {
  return readLoads().filter((l) => l.dispatcherId === dispatcherId);
}
export function getLoadsByBrokerEmail(email: string): Load[] {
  const e = email.trim().toLowerCase();
  return readLoads().filter((l) => l.brokerEmail.toLowerCase() === e);
}

export function getLoadsByDriverEmail(email: string): Load[] {
  const e = email.trim().toLowerCase();
  return readLoads().filter((l) => l.driverEmail.toLowerCase() === e);
}

/* ---------- mutations ---------- */
export function setStatus(loadId: string, status: LoadStatus, actorId: string) {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].status = status;
  if (status === "Delivered" || status === "Closed") loads[i].progress = 1;
  writeLoads(loads);
  notifyParties(loads[i], actorId, `Status updated to "${status}"`);
  return loads[i];
}

export function addDocument(
  loadId: string,
  doc: Omit<LoadDocument, "id" | "uploadedAt">,
  actorId: string
) {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].documents.push({
    ...doc,
    id: crypto.randomUUID(),
    uploadedAt: new Date().toISOString(),
  });
  writeLoads(loads);
  notifyParties(loads[i], actorId, `New document uploaded: ${doc.name}`);
  return loads[i];
}

export function addPhoto(
  loadId: string,
  photo: Omit<LoadPhoto, "id" | "uploadedAt">,
  actorId: string
) {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].photos.push({
    ...photo,
    id: crypto.randomUUID(),
    uploadedAt: new Date().toISOString(),
  });
  writeLoads(loads);
  notifyParties(loads[i], actorId, "New cargo photo uploaded");
  return loads[i];
}

export function addMessage(
  loadId: string,
  msg: Omit<ChatMessage, "id" | "createdAt" | "readBy">,
  actorId: string
) {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].messages.push({
    ...msg,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    readBy: [msg.authorId],
  });
  writeLoads(loads);
  notifyParties(loads[i], actorId, `New message from ${msg.authorName}`);
  return loads[i];
}

export function markMessagesRead(loadId: string, userId: string) {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return;
  let changed = false;
  for (const m of loads[i].messages) {
    if (!m.readBy.includes(userId)) {
      m.readBy.push(userId);
      changed = true;
    }
  }
  if (changed) writeLoads(loads);
}

/* ---------- demo seed ---------- */
const CITY: Record<string, GeoPoint> = {
  "Dallas, TX": { lat: 32.7767, lng: -96.797 },
  "Atlanta, GA": { lat: 33.749, lng: -84.388 },
  "Chicago, IL": { lat: 41.8781, lng: -87.6298 },
  "Denver, CO": { lat: 39.7392, lng: -104.9903 },
};

export function ensureDemoLoadsFor(dispatcherId: string, dispatcherName: string) {
  const existing = getLoadsByDispatcher(dispatcherId);
  if (existing.length > 0) return;
  const now = new Date().toISOString();
  const loads = readLoads();
  const make = (
    ref: string,
    driverName: string,
    driverEmail: string,
    o: keyof typeof CITY,
    d: keyof typeof CITY,
    status: LoadStatus,
    progress: number
  ): Load => ({
    id: crypto.randomUUID(),
    ref,
    dispatcherId,
    driverName,
    driverEmail,
    brokerName: "Demo Broker",
    brokerEmail: "broker@demo.com",
    brokerPhone: "",
    hasBroker: false,
    shareLocationWithBroker: true,
    originName: o,
    destName: d,
    origin: CITY[o],
    dest: CITY[d],
    progress,
    locationUpdatedAt: now,
    held: false,
    status,
    documents: [],
    photos: [],
    messages: [
      {
        id: crypto.randomUUID(),
        authorId: dispatcherId,
        authorName: dispatcherName,
        authorRole: "dispatcher",
        text: "Load assigned — please confirm pickup window.",
        attachments: [],
        createdAt: now,
        readBy: [dispatcherId],
      },
    ],
    createdAt: now,
  });

  loads.push(
    make("LS-48217", "Mike Torres", "mike.driver@demo.com", "Dallas, TX", "Atlanta, GA", "In Transit", 0.45),
    make("LS-48220", "Mike Torres", "mike.driver@demo.com", "Chicago, IL", "Denver, CO", "Assigned", 0),
    make("LS-48231", "Sara Kim", "sara.driver@demo.com", "Denver, CO", "Dallas, TX", "Picked Up", 0.15)
  );
  writeLoads(loads);
}

export function userById(id: string) {
  return getUserById(id);
}
