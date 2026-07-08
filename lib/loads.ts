import crypto from "crypto";
import fs from "fs";
import path from "path";
import { findByEmail, getUserById } from "@/lib/auth";
import { getDriverGlobalLocation } from "@/lib/driver-location";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
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
  "invoice_broker",
  "invoice_driver",
  "driver_rate_sheet",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const PHOTO_PHASES = ["before_pickup", "in_transit", "at_delivery"] as const;
export type PhotoPhase = (typeof PHOTO_PHASES)[number];

export type GeoPoint = { lat: number; lng: number };

// A single pickup or drop-off within a load (loads can have many of each).
export type Stop = {
  id: string;
  kind: "pickup" | "dropoff";
  address: string;
  time?: string;
  point?: GeoPoint;
  done?: boolean;
  doneAt?: string;
};

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
  brokerVisible?: boolean; // dispatcher chose to show this photo to the broker
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
  dispatcherName?: string; // denormalized name of the dispatcher who created it
  driverName: string;
  driverEmail: string;
  brokerName: string;
  brokerEmail: string;
  brokerPhone: string;
  hasBroker: boolean; // true only when a broker exists in the system for this load
  // Broker contact pulled from the rate confirmation — who the dispatcher calls
  // or emails to book. Kept separate from brokerEmail (a registered broker user
  // for sharing/access control), so the dispatcher always sees this on the load.
  brokerContactName?: string;
  brokerContactEmail?: string;
  brokerContactPhone?: string;
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
  // Real GPS reported by the driver's phone (foreground). Driver controls sharing.
  driverPoint?: GeoPoint;
  driverLocationAt?: string;
  driverShareLocation?: boolean; // driver's own toggle (default true)
  driverSharePausedPoint?: GeoPoint; // frozen last point when driver turns sharing off
  driverSharePausedAt?: string;
  // Truck route info (HERE): remaining distance + ETA to delivery.
  remainingMeters?: number;
  etaSeconds?: number; // remaining driving time in seconds
  etaCalcAt?: string; // when it was last computed (throttle HERE calls)
  stops?: Stop[]; // multi-stop loads: every pickup and drop-off, in order
  billTo?: string; // who the invoice is sent to (broker/customer from the rate con)
  status: LoadStatus;
  documents: LoadDocument[];
  photos: LoadPhoto[];
  messages: ChatMessage[];
  brokerInvoice?: InvoiceCell;
  driverInvoice?: InvoiceCell;
  loadRate?: number; // full load price from the rate confirmation
  driverRate?: number; // dispatcher-set pay shown to the driver (broker sees original)
  shareToken?: string; // public broker link token
  shareCode?: string; // access code the broker types to open the link
  shareRevoked?: boolean; // dispatcher closed broker access to this load
  brokerPublished?: boolean; // dispatcher released final docs to the broker
  brokerPublishedAt?: string;
  pickupDate?: string; // YYYY-MM-DD — scheduled pickup day (for the calendar)
  deliveryDate?: string; // YYYY-MM-DD — scheduled delivery day (for the calendar)
  deliveredAt?: string; // ISO — when the load was first marked Delivered/Closed
  brokerPaid?: boolean; // dispatcher marked the broker's payment received (A/R)
  brokerPaidAt?: string; // ISO — when payment was recorded
  demo?: boolean; // sample data, removable via "Remove demo data"
  createdAt: string;
};

export type InvoiceEvent = {
  id: string;
  action: "created" | "updated" | "sent";
  amount: number;
  notes: string;
  at: string;
  byName: string;
};

export type InvoiceCell = {
  amount: number; // broker: billed amount; driver: payout to driver
  currency: string;
  notes: string;
  status: "draft" | "sent";
  number: string;
  updatedAt: string;
  history: InvoiceEvent[];
  // driver-invoice breakdown (optional)
  gross?: number; // full load price
  commissionType?: "pct" | "amt";
  commissionValue?: number; // 10 (=10%) or 200 (=$200)
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
  // While held (privacy hold), show the real parked position captured at hold start.
  if (load.held && load.heldPoint) return load.heldPoint;
  // Driver turned their own sharing OFF: freeze at the last reported point.
  if (load.driverShareLocation === false && load.driverSharePausedPoint) {
    return load.driverSharePausedPoint;
  }
  // Driver is sharing real GPS: that is the true trailer position.
  if (load.driverShareLocation !== false && load.driverPoint) {
    return load.driverPoint;
  }
  // No live GPS yet: show the driver's last known real position (from any recent
  // load or heartbeat) so the dispatcher sees where they actually are; if we've
  // never had a fix, fall back to the pickup. No fake "moving" dot.
  const last = getDriverGlobalLocation(load.driverEmail);
  if (last) return { lat: last.lat, lng: last.lng };
  return { lat: load.origin.lat, lng: load.origin.lng };
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

// The driver's phone reports its real GPS position (foreground). Stored only when
// the driver is currently sharing; ignored otherwise.
export function setDriverLocation(
  loadId: string,
  point: GeoPoint
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  // Respect the driver's own toggle: if they've turned sharing off, don't update.
  if (loads[i].driverShareLocation === false) return loads[i];
  loads[i].driverPoint = point;
  loads[i].driverLocationAt = new Date().toISOString();
  writeLoads(loads);
  return loads[i];
}

// The driver's own show/hide toggle. When turned OFF, we freeze the last known
// point so the dispatcher keeps seeing where the driver was, clearly labeled.
export function setDriverShareLocation(
  loadId: string,
  value: boolean
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].driverShareLocation = value;
  if (!value) {
    loads[i].driverSharePausedPoint =
      loads[i].driverPoint ?? currentPoint(loads[i]);
    loads[i].driverSharePausedAt = new Date().toISOString();
  } else {
    loads[i].driverSharePausedPoint = undefined;
    loads[i].driverSharePausedAt = undefined;
  }
  writeLoads(loads);
  return loads[i];
}

// Dispatcher edits the pickup/delivery address text. Coordinates are refreshed
// separately (via HERE geocoding) by the caller using setLoadGeo.
export function setLoadAddresses(
  loadId: string,
  originName?: string,
  destName?: string
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  if (typeof originName === "string" && originName.trim())
    loads[i].originName = originName.trim();
  if (typeof destName === "string" && destName.trim())
    loads[i].destName = destName.trim();
  writeLoads(loads);
  return loads[i];
}

// Driver marks a stop done / not done.
export function toggleStopDone(
  loadId: string,
  stopId: string,
  done: boolean
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1 || !loads[i].stops) return loads[i];
  const stop = loads[i].stops!.find((st) => st.id === stopId);
  if (!stop) return loads[i];
  stop.done = done;
  stop.doneAt = done ? new Date().toISOString() : undefined;
  writeLoads(loads);
  return loads[i];
}

// Replace the stops list (dispatcher edit).
export function setStops(loadId: string, stops: Stop[]): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].stops = stops.length > 0 ? stops : undefined;
  writeLoads(loads);
  return loads[i];
}

// Persist precise geocoded coordinates for pickup/delivery (from HERE), so the
// map, ETA and routing all use real points instead of the city-list fallback.
export function setLoadGeo(
  loadId: string,
  origin?: GeoPoint,
  dest?: GeoPoint
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  if (origin) loads[i].origin = origin;
  if (dest) loads[i].dest = dest;
  writeLoads(loads);
  return loads[i];
}

// Store the latest truck-route remaining distance + ETA (computed via HERE).
export function setLoadEta(
  loadId: string,
  remainingMeters: number,
  etaSeconds: number
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].remainingMeters = remainingMeters;
  loads[i].etaSeconds = etaSeconds;
  loads[i].etaCalcAt = new Date().toISOString();
  writeLoads(loads);
  return loads[i];
}

// Whether the ETA is stale enough to recompute (throttle HERE usage).
export function etaIsStale(load: Load, maxAgeSeconds = 180): boolean {
  if (!load.etaCalcAt) return true;
  return Date.now() - new Date(load.etaCalcAt).getTime() > maxAgeSeconds * 1000;
}

// Dispatcher sets/updates an invoice cell (broker or driver). Amount is manual
// and persists; every change is recorded in the cell's history.
export function setInvoice(
  loadId: string,
  kind: "broker" | "driver",
  data: {
    amount: number;
    notes?: string;
    currency?: string;
    gross?: number;
    commissionType?: "pct" | "amt";
    commissionValue?: number;
  },
  actorName: string
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  const key = kind === "broker" ? "brokerInvoice" : "driverInvoice";
  const existing = loads[i][key];
  const now = new Date().toISOString();
  const event: InvoiceEvent = {
    id: crypto.randomUUID(),
    action: existing ? "updated" : "created",
    amount: data.amount,
    notes: data.notes ?? "",
    at: now,
    byName: actorName,
  };
  const cell: InvoiceCell = {
    amount: data.amount,
    currency: data.currency ?? existing?.currency ?? "$",
    notes: data.notes ?? existing?.notes ?? "",
    status: "draft",
    number: existing?.number ?? `${loads[i].ref}-${kind === "broker" ? "B" : "D"}`,
    updatedAt: now,
    history: [...(existing?.history ?? []), event],
    gross: data.gross ?? existing?.gross,
    commissionType: data.commissionType ?? existing?.commissionType,
    commissionValue: data.commissionValue ?? existing?.commissionValue,
  };
  loads[i][key] = cell;
  writeLoads(loads);
  return loads[i];
}

export function markInvoiceSent(
  loadId: string,
  kind: "broker" | "driver",
  actorName: string
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  const key = kind === "broker" ? "brokerInvoice" : "driverInvoice";
  const cell = loads[i][key];
  if (!cell) return undefined;
  cell.status = "sent";
  cell.updatedAt = new Date().toISOString();
  cell.history.push({
    id: crypto.randomUUID(),
    action: "sent",
    amount: cell.amount,
    notes: cell.notes,
    at: cell.updatedAt,
    byName: actorName,
  });
  loads[i][key] = cell;
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
  const driver = findByEmail(load.driverEmail);
  const recipients = new Set<string>();
  recipients.add(load.dispatcherId);
  if (broker) recipients.add(broker.id);
  if (driver) recipients.add(driver.id);
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

// Delete a single notification (only the owner's).
export function deleteNotification(userId: string, notifId: string) {
  const n = readNotifs();
  const next = n.filter((x) => !(x.id === notifId && x.userId === userId));
  if (next.length !== n.length) writeNotifs(next);
}

// Delete all of a user's notifications.
export function clearNotifications(userId: string) {
  const n = readNotifs();
  const next = n.filter((x) => x.userId !== userId);
  if (next.length !== n.length) writeNotifs(next);
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

// Set (or clear) the scheduled pickup/delivery dates for a load. Returns the
// updated load, or null when not found / not owned by this dispatcher.
export function setLoadSchedule(
  id: string,
  dispatcherId: string,
  pickupDate?: string,
  deliveryDate?: string,
  isAdmin = false
): Load | null {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === id);
  if (i === -1) return null;
  if (!isAdmin && loads[i].dispatcherId !== dispatcherId) return null;
  const clean = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : undefined);
  loads[i].pickupDate = clean(pickupDate);
  loads[i].deliveryDate = clean(deliveryDate);
  writeLoads(loads);
  return loads[i];
}

// Total value of completed (Delivered/Closed) loads for a dispatcher — the base
// used to compute their commission earnings.
export function completedRevenue(dispatcherId: string): { count: number; total: number } {
  const loads = getLoadsByDispatcher(dispatcherId).filter(
    (l) => l.status === "Delivered" || l.status === "Closed"
  );
  const total = loads.reduce((s, l) => s + (l.loadRate || 0), 0);
  return { count: loads.length, total };
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
  if (status === "Delivered" || status === "Closed") {
    loads[i].progress = 1;
    if (!loads[i].deliveredAt) loads[i].deliveredAt = new Date().toISOString();
  }
  writeLoads(loads);
  notifyParties(loads[i], actorId, `Status updated to "${status}"`);
  return loads[i];
}

// Record (or clear) that the broker has paid for a delivered load — drives the
// receivables / accounts-receivable view.
export function setBrokerPaid(
  loadId: string,
  paid: boolean,
  requesterId: string,
  isAdmin: boolean
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  if (!isAdmin && loads[i].dispatcherId !== requesterId) return undefined;
  loads[i].brokerPaid = paid;
  loads[i].brokerPaidAt = paid ? new Date().toISOString() : undefined;
  writeLoads(loads);
  return loads[i];
}

/* ---------- broker share link ---------- */

function genShareToken(): string {
  return crypto.randomBytes(16).toString("hex"); // 32-char URL token
}
function genShareCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

// Create the share token + code once; returns the load (existing values kept).
export function ensureBrokerShare(loadId: string): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  if (!loads[i].shareToken) loads[i].shareToken = genShareToken();
  if (!loads[i].shareCode) loads[i].shareCode = genShareCode();
  writeLoads(loads);
  return loads[i];
}

export function getLoadByToken(token: string): Load | undefined {
  if (!token) return undefined;
  return readLoads().find((l) => l.shareToken === token);
}

// Close (revoke) or reopen broker access to a load without changing the link/code.
export function setBrokerShareRevoked(
  loadId: string,
  revoked: boolean
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].shareRevoked = revoked;
  writeLoads(loads);
  return loads[i];
}

export function setPhotoBrokerVisible(
  loadId: string,
  photoId: string,
  visible: boolean
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  const ph = (loads[i].photos || []).find((p) => p.id === photoId);
  if (!ph) return loads[i];
  ph.brokerVisible = visible;
  writeLoads(loads);
  return loads[i];
}

// Release the final documents (invoice, papers) to the broker link.
export function publishToBroker(loadId: string): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  if (!loads[i].shareToken) loads[i].shareToken = genShareToken();
  if (!loads[i].shareCode) loads[i].shareCode = genShareCode();
  loads[i].brokerPublished = true;
  loads[i].brokerPublishedAt = new Date().toISOString();
  writeLoads(loads);
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
  const typeLabel =
    doc.type === "bol"
      ? "BOL (Bill of Lading)"
      : doc.type === "pod"
      ? "POD (proof of delivery)"
      : doc.type === "rate_confirmation"
      ? "rate confirmation"
      : doc.type === "invoice_broker" || doc.type === "invoice_driver"
      ? "invoice"
      : "document";
  notifyParties(loads[i], actorId, `New ${typeLabel}: ${doc.name}`);
  return loads[i];
}

// Save (or replace) the AI-generated broker invoice as a load document so it is
// stored with the load and automatically included when the dispatcher sends the
// final documents to the broker. Re-saving replaces the previous AI invoice, so
// regenerating never leaves duplicate invoices behind.
export function saveBrokerInvoiceDoc(
  loadId: string,
  doc: { name: string; dataUrl: string },
  actor: { id: string; name: string }
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  // Remove any earlier broker invoice (only ever the AI one — it is never
  // uploaded manually) to avoid piling up duplicates on regenerate.
  loads[i].documents = (loads[i].documents || []).filter(
    (d) => d.type !== "invoice_broker"
  );
  loads[i].documents.push({
    id: crypto.randomUUID(),
    type: "invoice_broker",
    name: String(doc.name).slice(0, 120),
    dataUrl: doc.dataUrl,
    uploadedById: actor.id,
    uploadedByName: actor.name,
    uploadedAt: new Date().toISOString(),
  });
  writeLoads(loads);
  notifyParties(loads[i], actor.id, `Invoice ready: ${doc.name}`);
  return loads[i];
}

// Set (or clear) the driver-facing pay for a load, and store the generated
// "Driver rate sheet" PDF as a document. The broker always keeps the original
// rate confirmation — this sheet is shown only to the driver.
export function setDriverRate(
  loadId: string,
  rate: number | undefined,
  sheetDataUrl: string,
  actor: { id: string; name: string }
): Load | undefined {
  const loads = readLoads();
  const i = loads.findIndex((l) => l.id === loadId);
  if (i === -1) return undefined;
  loads[i].driverRate = rate;
  // Replace any existing driver rate sheet.
  loads[i].documents = (loads[i].documents || []).filter(
    (d) => d.type !== "driver_rate_sheet"
  );
  if (rate && sheetDataUrl) {
    loads[i].documents.push({
      id: crypto.randomUUID(),
      type: "driver_rate_sheet",
      name: "Driver rate sheet.pdf",
      dataUrl: sheetDataUrl,
      uploadedById: actor.id,
      uploadedByName: actor.name,
      uploadedAt: new Date().toISOString(),
    });
  }
  writeLoads(loads);
  return loads[i];
}

// Transform a load for the DRIVER's eyes: if the dispatcher set a driver pay,
// show that amount instead of the broker rate, and present the driver rate sheet
// in place of the original rate confirmation (which stays with the broker).
export function serializeForDriver(load: Load): Load {
  if (!load.driverRate) return load;
  const sheet = (load.documents || []).find((d) => d.type === "driver_rate_sheet");
  let documents = load.documents || [];
  if (sheet) {
    documents = documents
      .filter((d) => d.type !== "rate_confirmation" && d.type !== "driver_rate_sheet")
      .concat([{ ...sheet, type: "rate_confirmation", name: "Rate confirmation.pdf" }]);
  }
  return { ...load, loadRate: load.driverRate, documents };
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
  "Houston, TX": { lat: 29.7604, lng: -95.3698 },
  "Phoenix, AZ": { lat: 33.4484, lng: -112.074 },
  "Los Angeles, CA": { lat: 34.0522, lng: -118.2437 },
  "Las Vegas, NV": { lat: 36.1699, lng: -115.1398 },
  "Seattle, WA": { lat: 47.6062, lng: -122.3321 },
  "Portland, OR": { lat: 45.5152, lng: -122.6784 },
  "Salt Lake City, UT": { lat: 40.7608, lng: -111.891 },
  "Kansas City, MO": { lat: 39.0997, lng: -94.5786 },
  "St. Louis, MO": { lat: 38.627, lng: -90.1994 },
  "Memphis, TN": { lat: 35.1495, lng: -90.049 },
  "Nashville, TN": { lat: 36.1627, lng: -86.7816 },
  "Indianapolis, IN": { lat: 39.7684, lng: -86.1581 },
  "Columbus, OH": { lat: 39.9612, lng: -82.9988 },
  "Detroit, MI": { lat: 42.3314, lng: -83.0458 },
  "Minneapolis, MN": { lat: 44.9778, lng: -93.265 },
  "Charlotte, NC": { lat: 35.2271, lng: -80.8431 },
  "Miami, FL": { lat: 25.7617, lng: -80.1918 },
  "Orlando, FL": { lat: 28.5383, lng: -81.3792 },
  "Jacksonville, FL": { lat: 30.3322, lng: -81.6557 },
  "New York, NY": { lat: 40.7128, lng: -74.006 },
  "Philadelphia, PA": { lat: 39.9526, lng: -75.1652 },
  "Newark, NJ": { lat: 40.7357, lng: -74.1724 },
  "Boston, MA": { lat: 42.3601, lng: -71.0589 },
  "Baltimore, MD": { lat: 39.2904, lng: -76.6122 },
  "Oklahoma City, OK": { lat: 35.4676, lng: -97.5164 },
  "San Antonio, TX": { lat: 29.4241, lng: -98.4936 },
  "El Paso, TX": { lat: 31.7619, lng: -106.485 },
  "Albuquerque, NM": { lat: 35.0844, lng: -106.6504 },
  "Sacramento, CA": { lat: 38.5816, lng: -121.4944 },
  "Oakland, CA": { lat: 37.8044, lng: -122.2712 },
};

const US_CENTER: GeoPoint = { lat: 39.5, lng: -98.35 };

// Best-effort coordinates for a typed city. Unknown cities land at US center,
// so the load still works and shows on the map (refine later with geocoding).
export function geocodeCity(name: string): GeoPoint {
  if (!name) return US_CENTER;
  if (CITY[name]) return CITY[name];
  // Pull a "City, ST" out of a longer address line if present.
  const m = name.match(/([A-Za-z .'-]+,\s*[A-Z]{2})/);
  const key = (m ? m[1] : name).trim();
  if (CITY[key]) return CITY[key];
  const ci = Object.keys(CITY).find((c) => c.toLowerCase() === key.toLowerCase());
  return ci ? CITY[ci] : US_CENTER;
}

export function createLoad(input: {
  dispatcherId: string;
  ref?: string;
  driverName: string;
  driverEmail: string;
  originName: string;
  destName: string;
  brokerName?: string;
  brokerEmail?: string;
  brokerPhone?: string;
  brokerContactName?: string;
  brokerContactEmail?: string;
  brokerContactPhone?: string;
  rate?: number;
  stops?: Stop[];
  billTo?: string;
  demo?: boolean;
}): Load {
  const now = new Date().toISOString();
  const ref =
    input.ref?.trim() ||
    `LS-${Math.floor(10000 + Math.random() * 89999)}`;
  const load: Load = {
    id: crypto.randomUUID(),
    ref,
    dispatcherId: input.dispatcherId,
    dispatcherName: getUserById(input.dispatcherId)?.name || "",
    driverName: input.driverName,
    driverEmail: input.driverEmail.trim().toLowerCase(),
    brokerName: input.brokerName || "",
    brokerEmail: (input.brokerEmail || "").trim().toLowerCase(),
    brokerPhone: input.brokerPhone || "",
    brokerContactName: input.brokerContactName?.trim() || undefined,
    brokerContactEmail: input.brokerContactEmail?.trim() || undefined,
    brokerContactPhone: input.brokerContactPhone?.trim() || undefined,
    hasBroker: false,
    shareLocationWithBroker: true,
    originName: input.originName,
    destName: input.destName,
    origin: geocodeCity(input.originName),
    dest: geocodeCity(input.destName),
    progress: 0,
    locationUpdatedAt: now,
    held: false,
    status: "Assigned",
    documents: [],
    photos: [],
    messages: [],
    loadRate: input.rate && input.rate > 0 ? input.rate : undefined,
    stops: input.stops && input.stops.length > 0 ? input.stops : undefined,
    billTo: input.billTo?.trim() || undefined,
    demo: input.demo || undefined,
    createdAt: now,
  };
  const loads = readLoads();
  loads.push(load);
  writeLoads(loads);
  // Notify the assigned driver (if they have an account).
  const driver = findByEmail(load.driverEmail);
  if (driver)
    pushNotification(
      driver.id,
      `New load assigned: ${load.ref} — ${load.originName} → ${load.destName}`,
      load
    );
  return load;
}

// Remove all demo-flagged loads for a dispatcher (used by "Remove demo data").
export function deleteDemoLoads(dispatcherId: string): number {
  const loads = readLoads();
  const kept = loads.filter((l) => !(l.demo && l.dispatcherId === dispatcherId));
  const removed = loads.length - kept.length;
  if (removed > 0) writeLoads(kept);
  return removed;
}

export function deleteLoad(
  loadId: string,
  requesterId: string,
  isAdmin: boolean
): boolean {
  const loads = readLoads();
  const load = loads.find((l) => l.id === loadId);
  if (!load) return false;
  if (!isAdmin && load.dispatcherId !== requesterId) return false;
  writeLoads(loads.filter((l) => l.id !== loadId));
  return true;
}

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
