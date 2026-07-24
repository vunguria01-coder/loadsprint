import fs from "fs";
import path from "path";
import { createInvite, deleteDemoInvites } from "@/lib/invites";
import {
  createTruck,
  addExpense,
  addFuelCard,
  addTruckDoc,
  addMaintenance,
  getTrucksByOwner,
  deleteDemoTrucks,
} from "@/lib/trucks";
import {
  createLoad,
  setStatus,
  setLoadEta,
  getLoadsByDispatcher,
  deleteDemoLoads,
} from "@/lib/loads";
import { setDriverPay, deleteDriverPay } from "@/lib/driver-pay";
import { setDriverGlobalLocation, deleteDriverGlobalLocation } from "@/lib/driver-location";

// Per-dispatcher sample data so a brand-new account isn't empty — a driver, a
// truck (with costs, fuel card, docs and maintenance) and two loads, all flagged
// demo:true so "Remove demo data" can wipe them in one click. Seeds ONCE per
// owner, and never again after removal.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "demo-state.json");

type State = Record<string, { seeded?: boolean; removed?: boolean }>;

function readState(): State {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as State;
  } catch {
    return {};
  }
}
function writeState(s: State) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), "utf8");
}
function setState(ownerId: string, patch: { seeded?: boolean; removed?: boolean }) {
  const s = readState();
  s[ownerId] = { ...s[ownerId], ...patch };
  writeState(s);
}

type Dispatcher = { id: string; name?: string; ownerId?: string };

// Readable, per-owner demo driver emails (unique so GPS/pay don't collide).
function demoDriverEmail(ownerId: string): string {
  return `alex.demo.${ownerId.slice(0, 8)}@sample.loadsprint`;
}
function demoDriverEmail2(ownerId: string): string {
  return `maria.demo.${ownerId.slice(0, 8)}@sample.loadsprint`;
}

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ISO timestamp `hours` from now (negative = in the past) — for live-feeling
// appointment countdowns on the demo board.
function isoIn(hours: number): string {
  const d = new Date();
  d.setTime(d.getTime() + hours * 3600 * 1000);
  return d.toISOString();
}

export function hasDispatcherDemo(me: Dispatcher): boolean {
  const ownerId = me.ownerId || me.id;
  return (
    getTrucksByOwner(ownerId).some((t) => t.demo) ||
    getLoadsByDispatcher(me.id).some((l) => l.demo)
  );
}

// Seed the demo set for an empty account. Idempotent + one-shot via demo-state.
export function ensureDispatcherDemo(me: Dispatcher): void {
  const ownerId = me.ownerId || me.id;
  try {
    const st = readState()[ownerId];
    if (st?.seeded || st?.removed) return;

    // Skip real accounts that already have their own data.
    const realTrucks = getTrucksByOwner(ownerId).some((t) => !t.demo);
    const realLoads = getLoadsByDispatcher(me.id).some((l) => !l.demo);
    if (realTrucks || realLoads) {
      setState(ownerId, { seeded: true });
      return;
    }

    const email = demoDriverEmail(ownerId);
    const driverName = "Alex Rivera (demo)";
    const email2 = demoDriverEmail2(ownerId);
    const driverName2 = "Maria Chen (demo)";

    // Driver invites (no login needed — it's just sample data).
    createInvite(email, me.id, me.name || "You", "driver", true);
    createInvite(email2, me.id, me.name || "You", "driver", true);

    // A truck with real-looking financials, a fuel card, docs and maintenance.
    const truck = createTruck({
      ownerId,
      name: "Freightliner Cascadia (demo)",
      unit: "118",
      make: "Freightliner",
      model: "Cascadia",
      year: 2021,
      plate: "TX 8842ABC",
      driverEmail: email,
      purchasePrice: 145000,
      purchaseDate: ymd(-480),
      eldProvider: "motive",
      eldVehicleId: "MV-118",
      demo: true,
    });
    const withCard = addFuelCard(truck.id, ownerId, false, {
      label: "Comdata",
      provider: "Comdata",
      last4: "1234",
      note: "PIN with dispatcher",
    });
    const cardId = withCard?.fuelCards[0]?.id;
    const exp = (kind: Parameters<typeof addExpense>[3]["kind"], amount: number, offset: number, note: string, extra: Partial<Parameters<typeof addExpense>[3]> = {}) =>
      addExpense(truck.id, ownerId, false, { kind, amount, date: ymd(offset), note, ...extra });
    exp("repair", 2150, -3, "Front brakes + rotors", { odometer: 512340 });
    exp("fuel", 940, -4, "Fill-up, Love's Amarillo", { gallons: 220, fuelCardId: cardId });
    exp("maintenance", 380, -20, "Oil + filters PM", { odometer: 508900 });
    exp("insurance", 1200, -34, "Physical damage + liability");
    exp("fuel", 1020, -23, "Fill-up, TA Oklahoma City", { gallons: 240, fuelCardId: cardId });
    exp("loan", 2600, -46, "Truck note");
    // Docs: one due soon, one overdue, one fine.
    addTruckDoc(truck.id, ownerId, false, { kind: "insurance", expiryDate: ymd(9), note: "Progressive #PC-8842" });
    addTruckDoc(truck.id, ownerId, false, { kind: "registration", expiryDate: ymd(-12), note: "TX plate" });
    addTruckDoc(truck.id, ownerId, false, { kind: "ifta", expiryDate: ymd(150), note: "" });
    // Maintenance: one overdue, one due soon (odometer 512,340).
    addMaintenance(truck.id, ownerId, false, { kind: "oil", intervalMiles: 10000, lastServiceMiles: 500000, lastServiceDate: ymd(-60) });
    addMaintenance(truck.id, ownerId, false, { kind: "brakes", intervalMiles: 13000, lastServiceMiles: 500000, lastServiceDate: ymd(-60) });

    // Trucks/trailers running the sample loads (unit 118 is the truck seeded above).
    const T1 = { truck: "118", trailer: "53-5521" };
    const T2 = { truck: "204", trailer: "53-7730" };

    // A full operational board: every status represented, with truck/trailer,
    // appointment windows and live ETA so the dashboard reads like a real TMS.
    // One delivered load drives Profit/Receivables; the rest are in motion.
    const delivered = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4471",
      driverName,
      driverEmail: email,
      originName: "Dallas, TX",
      destName: "Atlanta, GA",
      brokerName: "Ace Freight Brokers",
      rate: 2450,
      truckNumber: T1.truck,
      trailerNumber: T1.trailer,
      deliveryApptAt: isoIn(-20),
      demo: true,
    });
    setStatus(delivered.id, "Delivered", me.id);

    const moving = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4488",
      driverName,
      driverEmail: email,
      originName: "Chicago, IL",
      destName: "Denver, CO",
      brokerName: "Ace Freight Brokers",
      rate: 1980,
      truckNumber: T1.truck,
      trailerNumber: T1.trailer,
      pickupApptAt: isoIn(-6),
      deliveryApptAt: isoIn(7),
      demo: true,
    });
    setStatus(moving.id, "In Transit", me.id);
    setLoadEta(moving.id, 918000, 32400); // ~570 mi, ~9h

    const assigned = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4502",
      driverName: driverName2,
      driverEmail: email2,
      originName: "Denver, CO",
      destName: "Dallas, TX",
      brokerName: "Summit Logistics",
      rate: 2100,
      truckNumber: T2.truck,
      trailerNumber: T2.trailer,
      pickupApptAt: isoIn(4),
      deliveryApptAt: isoIn(28),
      demo: true,
    });
    setStatus(assigned.id, "Assigned", me.id);

    const picked = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4515",
      driverName: driverName2,
      driverEmail: email2,
      originName: "Kansas City, MO",
      destName: "Memphis, TN",
      brokerName: "Summit Logistics",
      rate: 1450,
      truckNumber: T2.truck,
      trailerNumber: T2.trailer,
      pickupApptAt: isoIn(-2),
      deliveryApptAt: isoIn(9),
      demo: true,
    });
    setStatus(picked.id, "Picked Up", me.id);
    setLoadEta(picked.id, 645000, 23400); // ~400 mi, ~6.5h

    const atDelivery = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4523",
      driverName,
      driverEmail: email,
      originName: "Memphis, TN",
      destName: "Nashville, TN",
      brokerName: "Ace Freight Brokers",
      rate: 900,
      truckNumber: T1.truck,
      trailerNumber: T1.trailer,
      pickupApptAt: isoIn(-5),
      deliveryApptAt: isoIn(1), // within 2h → "Appt Soon"
      demo: true,
    });
    setStatus(atDelivery.id, "At Delivery", me.id);
    setLoadEta(atDelivery.id, 32000, 2400); // ~20 mi, ~40m

    const delayed = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4531",
      driverName: driverName2,
      driverEmail: email2,
      originName: "Houston, TX",
      destName: "San Antonio, TX",
      brokerName: "Summit Logistics",
      rate: 780,
      truckNumber: T2.truck,
      trailerNumber: T2.trailer,
      pickupApptAt: isoIn(-9),
      deliveryApptAt: isoIn(-1.5), // appointment already passed → "Delayed"
      demo: true,
    });
    setStatus(delayed.id, "In Transit", me.id);
    setLoadEta(delayed.id, 64000, 3600); // ~40 mi, ~1h out

    // Driver pay rules (25%) so profit margins are real, plus fresh GPS pings so
    // both drivers read as "online" and trigger check-in alerts.
    setDriverPay(ownerId, email, "pct", 25);
    setDriverPay(ownerId, email2, "pct", 25);
    setDriverGlobalLocation(email, 39.9, -101.5, moving.id); // en route Chicago→Denver
    setDriverGlobalLocation(email2, 33.2, -95.6, picked.id); // en route KC→Memphis

    setState(ownerId, { seeded: true });
  } catch {
    // Demo seeding must never break a page load.
  }
}

// Wipe every demo record for this owner and never seed again.
export function removeDispatcherDemo(me: Dispatcher): void {
  const ownerId = me.ownerId || me.id;
  const email = demoDriverEmail(ownerId);
  const email2 = demoDriverEmail2(ownerId);
  deleteDemoTrucks(ownerId);
  deleteDemoLoads(me.id);
  deleteDemoInvites(me.id);
  deleteDriverPay(ownerId, email);
  deleteDriverPay(ownerId, email2);
  deleteDriverGlobalLocation(email);
  deleteDriverGlobalLocation(email2);
  setState(ownerId, { removed: true, seeded: true });
}
