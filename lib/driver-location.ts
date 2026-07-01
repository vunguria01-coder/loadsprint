import fs from "fs";
import path from "path";

// Last-known GPS position for each driver, keyed by lowercased email. This is
// independent of any single load, so a dispatcher can always see where a driver
// is — whether they're on a load right now or not.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "driver-locations.json");

export type DriverPing = { lat: number; lng: number; at: string; loadId?: string };
type Store = Record<string, DriverPing>;

function read(): Store {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function write(s: Store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2), "utf8");
}

export function setDriverGlobalLocation(
  email: string,
  lat: number,
  lng: number,
  loadId?: string
): void {
  if (!email || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const s = read();
  s[email.toLowerCase()] = { lat, lng, at: new Date().toISOString(), loadId };
  write(s);
}

export function getDriverGlobalLocation(email: string): DriverPing | null {
  if (!email) return null;
  return read()[email.toLowerCase()] || null;
}

export function getDriverGlobalLocations(
  emails: string[]
): Record<string, DriverPing> {
  const s = read();
  const out: Record<string, DriverPing> = {};
  for (const e of emails) {
    const p = s[e.toLowerCase()];
    if (p) out[e.toLowerCase()] = p;
  }
  return out;
}
