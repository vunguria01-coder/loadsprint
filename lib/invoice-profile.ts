import fs from "fs";
import path from "path";
import type { InvoiceProfile } from "@/lib/schemas";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "invoice-profiles.json");

const EMPTY: InvoiceProfile = {
  companyName: "",
  address: "",
  phone: "",
  email: "",
  payTerms: "",
  notes: "",
};

function readAll(): Record<string, InvoiceProfile> {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, InvoiceProfile>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

export function getInvoiceProfile(dispatcherId: string): InvoiceProfile {
  return { ...EMPTY, ...(readAll()[dispatcherId] ?? {}) };
}

export function setInvoiceProfile(
  dispatcherId: string,
  profile: InvoiceProfile
): InvoiceProfile {
  const all = readAll();
  all[dispatcherId] = { ...EMPTY, ...profile };
  writeAll(all);
  return all[dispatcherId];
}
