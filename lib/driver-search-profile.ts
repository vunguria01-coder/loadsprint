import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROFILE_FILE = path.join(DATA_DIR, "driver-search-profile.json");

// Empty/undefined field = "no filter" on that dimension when the load
// search runs later — this store never invents a default the dispatcher
// didn't actually set.
export type DriverSearchProfile = {
  equipment?: string; // one of lib/truck-constants.ts EQUIPMENT_TYPES
  trailerLengthFt?: number;
  deadheadRadiusMi?: number;
  preferredDirections?: string[]; // subset of DIRECTIONS
  minRatePerMile?: number;
};

const EMPTY: DriverSearchProfile = {};

// dispatcherId (the inviting dispatcher's user id, same id the drivers
// screen and /api/drivers/password already scope by) -> driver email
// (lowercased) -> profile. Same shape as lib/driver-pay.ts, which is the
// existing precedent for "a dispatcher-configured per-driver setting."
type Store = Record<string, Record<string, DriverSearchProfile>>;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROFILE_FILE)) fs.writeFileSync(PROFILE_FILE, "{}", "utf8");
}

function readAll(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  ensure();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function getDriverSearchProfile(
  dispatcherId: string,
  email: string
): DriverSearchProfile {
  const key = email.trim().toLowerCase();
  return { ...EMPTY, ...(readAll()[dispatcherId]?.[key] ?? {}) };
}

export function setDriverSearchProfile(
  dispatcherId: string,
  email: string,
  profile: DriverSearchProfile
): DriverSearchProfile {
  const s = readAll();
  if (!s[dispatcherId]) s[dispatcherId] = {};
  const key = email.trim().toLowerCase();
  const clean: DriverSearchProfile = { ...EMPTY, ...profile };
  s[dispatcherId][key] = clean;
  writeAll(s);
  return clean;
}

// Used by "Remove demo data", mirroring lib/driver-pay.ts's deleteDriverPay.
export function deleteDriverSearchProfile(dispatcherId: string, email: string) {
  const s = readAll();
  const key = email.trim().toLowerCase();
  if (s[dispatcherId]?.[key]) {
    delete s[dispatcherId][key];
    writeAll(s);
  }
}
