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

export const TRUCK_STATUSES = ["active", "in_shop", "parked", "sold"] as const;
export type TruckStatus = (typeof TRUCK_STATUSES)[number];

export const STATUS_LABELS: Record<TruckStatus, string> = {
  active: "Active",
  in_shop: "In shop",
  parked: "Parked",
  sold: "Sold",
};
