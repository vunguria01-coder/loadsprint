// Plain constants/types for trucks — no fs, so both server code (lib/trucks.ts,
// API routes) and client components can import these safely.

export const EXPENSE_KINDS = [
  "purchase",
  "repair",
  "maintenance",
  "fuel",
  "insurance",
  "loan",
  "tolls",
  "other",
] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_LABELS: Record<ExpenseKind, string> = {
  purchase: "Purchase / invested",
  repair: "Repair",
  maintenance: "Maintenance",
  fuel: "Fuel",
  insurance: "Insurance",
  loan: "Loan payment",
  tolls: "Tolls",
  other: "Other",
};

export const ELD_PROVIDERS = ["none", "motive", "samsara", "geotab", "other"] as const;
export type EldProvider = (typeof ELD_PROVIDERS)[number];

export const ELD_LABELS: Record<EldProvider, string> = {
  none: "None yet",
  motive: "Motive (KeepTruckin)",
  samsara: "Samsara",
  geotab: "Geotab",
  other: "Other",
};

// Compliance documents that expire (drive the Reminders page).
export const DOC_KINDS = ["insurance", "registration", "ifta", "inspection", "permit", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABELS: Record<DocKind, string> = {
  insurance: "Insurance",
  registration: "Registration",
  ifta: "IFTA",
  inspection: "Annual inspection",
  permit: "Permit",
  other: "Other document",
};

// Mileage-based maintenance schedules.
export const MAINT_KINDS = ["oil", "tires", "brakes", "pm", "dot", "other"] as const;
export type MaintKind = (typeof MAINT_KINDS)[number];
export const MAINT_LABELS: Record<MaintKind, string> = {
  oil: "Oil change",
  tires: "Tires",
  brakes: "Brakes",
  pm: "PM service",
  dot: "DOT inspection",
  other: "Other",
};

// Same trailer types offered on the public quote form (components/quote-form.tsx)
// — the one place LoadSprint already asks for an equipment type today.
export const EQUIPMENT_TYPES = [
  "dry_van",
  "reefer",
  "flatbed",
  "step_deck",
  "box_truck",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  dry_van: "Dry Van (53′)",
  reefer: "Reefer",
  flatbed: "Flatbed",
  step_deck: "Step Deck",
  box_truck: "Box Truck",
};

// Compass-style run preference, the common shorthand dispatchers use when
// asking a driver which direction they want their next load headed.
export const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DIRECTION_LABELS: Record<Direction, string> = {
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
};

export const TRUCK_STATUSES = ["active", "in_shop", "parked", "sold"] as const;
export type TruckStatus = (typeof TRUCK_STATUSES)[number];

export const STATUS_LABELS: Record<TruckStatus, string> = {
  active: "Active",
  in_shop: "In shop",
  parked: "Parked",
  sold: "Sold",
};
