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

// A readable, per-owner demo driver email (unique so GPS/pay don't collide).
function demoDriverEmail(ownerId: string): string {
  return `alex.demo.${ownerId.slice(0, 8)}@sample.loadsprint`;
}

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

    // Driver invite (no login needed — it's just sample data).
    createInvite(email, me.id, me.name || "You", "driver", true);

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

    // Two loads: one delivered (drives Profit/Receivables), one in transit.
    const delivered = createLoad({
      dispatcherId: me.id,
      ref: "DEMO-4471",
      driverName,
      driverEmail: email,
      originName: "Dallas, TX",
      destName: "Atlanta, GA",
      brokerName: "Ace Freight Brokers",
      rate: 2450,
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
      demo: true,
    });
    setStatus(moving.id, "In Transit", me.id);

    // Driver pay rule (25%) so profit margins are real, and a GPS position.
    setDriverPay(ownerId, email, "pct", 25);
    setDriverGlobalLocation(email, 41.8781, -87.6298); // Chicago

    setState(ownerId, { seeded: true });
  } catch {
    // Demo seeding must never break a page load.
  }
}

// Wipe every demo record for this owner and never seed again.
export function removeDispatcherDemo(me: Dispatcher): void {
  const ownerId = me.ownerId || me.id;
  const email = demoDriverEmail(ownerId);
  deleteDemoTrucks(ownerId);
  deleteDemoLoads(me.id);
  deleteDemoInvites(me.id);
  deleteDriverPay(ownerId, email);
  deleteDriverGlobalLocation(email);
  setState(ownerId, { removed: true, seeded: true });
}
