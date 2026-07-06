import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Load } from "@/lib/loads";
import {
  EXPENSE_KINDS,
  ELD_PROVIDERS,
  TRUCK_STATUSES,
  type ExpenseKind,
  type EldProvider,
  type TruckStatus,
} from "@/lib/truck-constants";

// Trucks: a dispatcher/owner's fleet. Each truck tracks its financials
// (purchase/investment, repairs, fuel, and other costs), an optional assigned
// driver (so we can show its location and attribute income), fuel cards, and an
// ELD link (Motive/Samsara/etc.) that a live integration can fill in later.
// Persisted as a flat JSON array in data/trucks.json, mirroring lib/loads.ts.
// Enum constants live in lib/truck-constants.ts (fs-free) so client components
// can import them too; re-exported here for existing server callers.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const TRUCKS_FILE = path.join(DATA_DIR, "trucks.json");

export {
  EXPENSE_KINDS,
  EXPENSE_LABELS,
  ELD_PROVIDERS,
  TRUCK_STATUSES,
} from "@/lib/truck-constants";
export type { ExpenseKind, EldProvider, TruckStatus } from "@/lib/truck-constants";

export type TruckExpense = {
  id: string;
  kind: ExpenseKind;
  amount: number;
  date: string; // YYYY-MM-DD
  note: string;
  odometer?: number;
  gallons?: number; // optional fuel detail
  fuelCardId?: string; // when paid by a fuel card
  createdAt: string;
};

export type FuelCard = {
  id: string;
  label: string; // e.g. "Comdata"
  provider: string; // Comdata / EFS / WEX / ...
  last4?: string;
  note?: string;
  createdAt: string;
};

// ELD / logbook link. `connected` stays false until a live provider integration
// (API key + vehicleId) is wired up; until then we fall back to the assigned
// driver's phone GPS for location.
export type EldLink = {
  provider: EldProvider;
  vehicleId?: string;
  connected: boolean;
};

export type Truck = {
  id: string;
  ownerId: string; // me.ownerId || me.id — shared across an owner's seats
  name: string; // nickname or make/model
  unit?: string; // unit / truck number
  vin?: string;
  plate?: string;
  make?: string;
  model?: string;
  year?: number;
  driverEmail?: string; // assigned driver (lowercased)
  purchasePrice?: number; // headline "invested" figure
  purchaseDate?: string; // YYYY-MM-DD
  status: TruckStatus;
  eld: EldLink;
  fuelCards: FuelCard[];
  expenses: TruckExpense[];
  createdAt: string;
};

/* ---------- file helpers ---------- */
function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TRUCKS_FILE)) fs.writeFileSync(TRUCKS_FILE, "[]", "utf8");
}

function readTrucks(): Truck[] {
  ensure();
  try {
    const arr = JSON.parse(fs.readFileSync(TRUCKS_FILE, "utf8")) as Truck[];
    // Backfill defaults so older rows keep working as fields are added.
    return arr.map((t) => ({
      ...t,
      status: t.status || "active",
      eld: t.eld || { provider: "none", connected: false },
      fuelCards: t.fuelCards || [],
      expenses: t.expenses || [],
    }));
  } catch {
    return [];
  }
}

function writeTrucks(trucks: Truck[]) {
  ensure();
  fs.writeFileSync(TRUCKS_FILE, JSON.stringify(trucks, null, 2), "utf8");
}

/* ---------- queries ---------- */
export function getTrucksByOwner(ownerId: string): Truck[] {
  return readTrucks()
    .filter((t) => t.ownerId === ownerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getTruckById(id: string): Truck | undefined {
  return readTrucks().find((t) => t.id === id);
}

// Ownership guard shared by every mutation (admin bypasses).
function owned(t: Truck, requesterId: string, isAdmin: boolean): boolean {
  return isAdmin || t.ownerId === requesterId;
}

/* ---------- mutations ---------- */
export function createTruck(input: {
  ownerId: string;
  name: string;
  unit?: string;
  vin?: string;
  plate?: string;
  make?: string;
  model?: string;
  year?: number;
  driverEmail?: string;
  purchasePrice?: number;
  purchaseDate?: string;
  eldProvider?: EldProvider;
  eldVehicleId?: string;
}): Truck {
  const now = new Date().toISOString();
  const truck: Truck = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    name: input.name.trim() || "Truck",
    unit: input.unit?.trim() || undefined,
    vin: input.vin?.trim() || undefined,
    plate: input.plate?.trim() || undefined,
    make: input.make?.trim() || undefined,
    model: input.model?.trim() || undefined,
    year: input.year && input.year > 0 ? input.year : undefined,
    driverEmail: input.driverEmail?.trim().toLowerCase() || undefined,
    purchasePrice:
      input.purchasePrice && input.purchasePrice > 0 ? input.purchasePrice : undefined,
    purchaseDate: input.purchaseDate?.trim() || undefined,
    status: "active",
    eld: {
      provider: input.eldProvider || "none",
      vehicleId: input.eldVehicleId?.trim() || undefined,
      connected: false,
    },
    fuelCards: [],
    expenses: [],
    createdAt: now,
  };
  const trucks = readTrucks();
  trucks.push(truck);
  writeTrucks(trucks);
  return truck;
}

export function updateTruck(
  id: string,
  requesterId: string,
  isAdmin: boolean,
  patch: Partial<
    Pick<
      Truck,
      | "name"
      | "unit"
      | "vin"
      | "plate"
      | "make"
      | "model"
      | "year"
      | "driverEmail"
      | "purchasePrice"
      | "purchaseDate"
      | "status"
    >
  > & { eldProvider?: EldProvider; eldVehicleId?: string }
): Truck | undefined {
  const trucks = readTrucks();
  const i = trucks.findIndex((t) => t.id === id);
  if (i === -1) return undefined;
  if (!owned(trucks[i], requesterId, isAdmin)) return undefined;
  const t = trucks[i];
  if (patch.name !== undefined) t.name = patch.name.trim() || t.name;
  if (patch.unit !== undefined) t.unit = patch.unit.trim() || undefined;
  if (patch.vin !== undefined) t.vin = patch.vin.trim() || undefined;
  if (patch.plate !== undefined) t.plate = patch.plate.trim() || undefined;
  if (patch.make !== undefined) t.make = patch.make.trim() || undefined;
  if (patch.model !== undefined) t.model = patch.model.trim() || undefined;
  if (patch.year !== undefined) t.year = patch.year && patch.year > 0 ? patch.year : undefined;
  if (patch.driverEmail !== undefined)
    t.driverEmail = patch.driverEmail.trim().toLowerCase() || undefined;
  if (patch.purchasePrice !== undefined)
    t.purchasePrice = patch.purchasePrice > 0 ? patch.purchasePrice : undefined;
  if (patch.purchaseDate !== undefined) t.purchaseDate = patch.purchaseDate.trim() || undefined;
  if (patch.status !== undefined) t.status = patch.status;
  if (patch.eldProvider !== undefined)
    t.eld = { ...t.eld, provider: patch.eldProvider };
  if (patch.eldVehicleId !== undefined)
    t.eld = { ...t.eld, vehicleId: patch.eldVehicleId.trim() || undefined };
  writeTrucks(trucks);
  return t;
}

export function deleteTruck(id: string, requesterId: string, isAdmin = false): boolean {
  const trucks = readTrucks();
  const t = trucks.find((x) => x.id === id);
  if (!t) return false;
  if (!owned(t, requesterId, isAdmin)) return false;
  writeTrucks(trucks.filter((x) => x.id !== id));
  return true;
}

export function addExpense(
  id: string,
  requesterId: string,
  isAdmin: boolean,
  exp: {
    kind: ExpenseKind;
    amount: number;
    date?: string;
    note?: string;
    odometer?: number;
    gallons?: number;
    fuelCardId?: string;
  }
): Truck | undefined {
  const trucks = readTrucks();
  const i = trucks.findIndex((t) => t.id === id);
  if (i === -1 || !owned(trucks[i], requesterId, isAdmin)) return undefined;
  const now = new Date().toISOString();
  trucks[i].expenses.push({
    id: crypto.randomUUID(),
    kind: exp.kind,
    amount: Math.max(0, Math.round(exp.amount * 100) / 100),
    date: exp.date?.trim() || now.slice(0, 10),
    note: (exp.note || "").slice(0, 240),
    odometer: exp.odometer && exp.odometer > 0 ? exp.odometer : undefined,
    gallons: exp.gallons && exp.gallons > 0 ? exp.gallons : undefined,
    fuelCardId: exp.fuelCardId || undefined,
    createdAt: now,
  });
  writeTrucks(trucks);
  return trucks[i];
}

export function removeExpense(
  id: string,
  requesterId: string,
  isAdmin: boolean,
  expenseId: string
): Truck | undefined {
  const trucks = readTrucks();
  const i = trucks.findIndex((t) => t.id === id);
  if (i === -1 || !owned(trucks[i], requesterId, isAdmin)) return undefined;
  trucks[i].expenses = trucks[i].expenses.filter((e) => e.id !== expenseId);
  writeTrucks(trucks);
  return trucks[i];
}

export function addFuelCard(
  id: string,
  requesterId: string,
  isAdmin: boolean,
  card: { label: string; provider?: string; last4?: string; note?: string }
): Truck | undefined {
  const trucks = readTrucks();
  const i = trucks.findIndex((t) => t.id === id);
  if (i === -1 || !owned(trucks[i], requesterId, isAdmin)) return undefined;
  trucks[i].fuelCards.push({
    id: crypto.randomUUID(),
    label: card.label.trim().slice(0, 60) || "Fuel card",
    provider: (card.provider || "").trim().slice(0, 40),
    last4: (card.last4 || "").replace(/\D/g, "").slice(-4) || undefined,
    note: (card.note || "").slice(0, 120) || undefined,
    createdAt: new Date().toISOString(),
  });
  writeTrucks(trucks);
  return trucks[i];
}

export function removeFuelCard(
  id: string,
  requesterId: string,
  isAdmin: boolean,
  cardId: string
): Truck | undefined {
  const trucks = readTrucks();
  const i = trucks.findIndex((t) => t.id === id);
  if (i === -1 || !owned(trucks[i], requesterId, isAdmin)) return undefined;
  trucks[i].fuelCards = trucks[i].fuelCards.filter((c) => c.id !== cardId);
  writeTrucks(trucks);
  return trucks[i];
}

/* ---------- aggregation / reports ---------- */

// Income for a truck = revenue from its assigned driver's delivered loads.
// (A truck has no direct load link yet; the driver is the best signal we have.)
function truckLoads(truck: Truck, loads: Load[]): Load[] {
  if (!truck.driverEmail) return [];
  const e = truck.driverEmail.toLowerCase();
  return loads.filter(
    (l) =>
      l.driverEmail.toLowerCase() === e &&
      (l.status === "Delivered" || l.status === "Closed")
  );
}

export type TruckFinance = {
  invested: number; // CAPITAL: purchasePrice + "purchase" expenses (not in net)
  repair: number; // repair + maintenance
  fuel: number;
  other: number; // insurance + loan + tolls + other
  cost: number; // OPERATING cost only (repair + fuel + other) — money out for P&L
  income: number; // delivered-load revenue for the assigned driver
  net: number; // operating profit = income - operating cost (excludes capital)
  byKind: Record<ExpenseKind, number>;
};

export function truckFinance(truck: Truck, loads: Load[]): TruckFinance {
  const byKind = Object.fromEntries(
    EXPENSE_KINDS.map((k) => [k, 0])
  ) as Record<ExpenseKind, number>;
  for (const e of truck.expenses) byKind[e.kind] += e.amount;
  // Capital invested (headline purchase price + any "purchase" expenses) is kept
  // OUT of operating profit — otherwise a newly bought truck looks like a huge
  // loss forever. It's reported separately as the money sunk into the truck.
  const invested = (truck.purchasePrice || 0) + byKind.purchase;
  const repair = byKind.repair + byKind.maintenance;
  const fuel = byKind.fuel;
  const other = byKind.insurance + byKind.loan + byKind.tolls + byKind.other;
  const cost = repair + fuel + other; // operating only
  const income = truckLoads(truck, loads).reduce((s, l) => s + (l.loadRate || 0), 0);
  return { invested, repair, fuel, other, cost, income, net: income - cost, byKind };
}

// Sum finances across a fleet.
export function fleetFinance(trucks: Truck[], loads: Load[]): TruckFinance {
  const zero = Object.fromEntries(EXPENSE_KINDS.map((k) => [k, 0])) as Record<
    ExpenseKind,
    number
  >;
  const acc: TruckFinance = {
    invested: 0,
    repair: 0,
    fuel: 0,
    other: 0,
    cost: 0,
    income: 0,
    net: 0,
    byKind: zero,
  };
  for (const t of trucks) {
    const f = truckFinance(t, loads);
    acc.invested += f.invested;
    acc.repair += f.repair;
    acc.fuel += f.fuel;
    acc.other += f.other;
    acc.cost += f.cost;
    acc.income += f.income;
    acc.net += f.net;
    for (const k of EXPENSE_KINDS) acc.byKind[k] += f.byKind[k];
  }
  return acc;
}

const ymKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

// Parse a "YYYY-MM-DD" expense date as LOCAL time. Using `new Date("2026-07-01")`
// interprets it as UTC midnight, which then buckets into the previous month in
// any timezone behind UTC. Building the date from parts keeps it in the intended
// month regardless of the server's timezone.
function parseYMD(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

export type PeriodBucket = {
  key: number; // ym key (month) or year number
  label: string; // "Mar 2026" or "2026"
  cost: number;
  income: number;
  net: number;
  byKind: Record<ExpenseKind, number>;
};

function emptyKinds(): Record<ExpenseKind, number> {
  return Object.fromEntries(EXPENSE_KINDS.map((k) => [k, 0])) as Record<
    ExpenseKind,
    number
  >;
}

// Monthly report over the last `months` months (oldest first). Expenses bucket
// by their `date`; income buckets by the linked load's createdAt.
export function monthlyReport(
  trucks: Truck[],
  loads: Load[],
  now: Date,
  months = 12
): PeriodBucket[] {
  const curYM = ymKey(now);
  const buckets: PeriodBucket[] = Array.from({ length: months }, (_, idx) => {
    const key = curYM - (months - 1 - idx);
    const year = Math.floor(key / 12);
    const month = key % 12;
    const label = new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    return { key, label, cost: 0, income: 0, net: 0, byKind: emptyKinds() };
  });
  const at = (key: number) => buckets.find((b) => b.key === key);
  for (const t of trucks) {
    for (const e of t.expenses) {
      const b = at(ymKey(parseYMD(e.date)));
      if (b) {
        b.byKind[e.kind] += e.amount;
        if (e.kind !== "purchase") b.cost += e.amount; // capital excluded from P&L
      }
    }
    for (const l of truckLoads(t, loads)) {
      const b = at(ymKey(new Date(l.createdAt)));
      if (b) b.income += l.loadRate || 0;
    }
  }
  for (const b of buckets) b.net = b.income - b.cost;
  return buckets;
}

// Yearly report (oldest first) across whatever years have data.
export function yearlyReport(
  trucks: Truck[],
  loads: Load[],
  now: Date,
  years = 3
): PeriodBucket[] {
  const curY = now.getFullYear();
  const buckets: PeriodBucket[] = Array.from({ length: years }, (_, idx) => {
    const year = curY - (years - 1 - idx);
    return {
      key: year,
      label: String(year),
      cost: 0,
      income: 0,
      net: 0,
      byKind: emptyKinds(),
    };
  });
  const at = (year: number) => buckets.find((b) => b.key === year);
  for (const t of trucks) {
    for (const e of t.expenses) {
      const b = at(parseYMD(e.date).getFullYear());
      if (b) {
        b.byKind[e.kind] += e.amount;
        if (e.kind !== "purchase") b.cost += e.amount; // capital excluded from P&L
      }
    }
    for (const l of truckLoads(t, loads)) {
      const b = at(new Date(l.createdAt).getFullYear());
      if (b) b.income += l.loadRate || 0;
    }
  }
  for (const b of buckets) b.net = b.income - b.cost;
  return buckets;
}
