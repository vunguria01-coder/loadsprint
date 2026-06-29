import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PAY_FILE = path.join(DATA_DIR, "driver-pay.json");

export type DriverPay = { type: "pct" | "flat"; rate: number };
// ownerId -> driver email (lowercased) -> pay setting
type Store = Record<string, Record<string, DriverPay>>;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PAY_FILE)) fs.writeFileSync(PAY_FILE, "{}", "utf8");
}

function readAll(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(PAY_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  ensure();
  fs.writeFileSync(PAY_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function getDriverPayMap(ownerId: string): Record<string, DriverPay> {
  return readAll()[ownerId] || {};
}

export function setDriverPay(
  ownerId: string,
  email: string,
  type: "pct" | "flat",
  rate: number
) {
  const s = readAll();
  if (!s[ownerId]) s[ownerId] = {};
  const key = email.trim().toLowerCase();
  if (!rate || rate <= 0) {
    delete s[ownerId][key];
  } else {
    s[ownerId][key] = { type, rate };
  }
  writeAll(s);
}
