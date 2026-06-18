import fs from "fs";
import path from "path";
import type { PricingValues, LimitsValues } from "@/lib/schemas";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULT_PRICING: PricingValues = {
  silver: 49,
  gold: 99,
  platinum: 199,
  currency: "$",
  period: "mo",
};

// Driver allowance per tier; extra drivers beyond the limit cost extraDriverPrice each.
const DEFAULT_LIMITS: LimitsValues = {
  silver: 2,
  gold: 8,
  platinum: 20,
  extraDriverPrice: 5,
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify({ pricing: DEFAULT_PRICING, limits: DEFAULT_LIMITS }, null, 2),
      "utf8"
    );
  }
}

function readAll(): { pricing?: Partial<PricingValues>; limits?: Partial<LimitsValues> } {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data: { pricing: PricingValues; limits: LimitsValues }) {
  ensure();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function getPricing(): PricingValues {
  return { ...DEFAULT_PRICING, ...(readAll().pricing ?? {}) };
}

export function getLimits(): LimitsValues {
  return { ...DEFAULT_LIMITS, ...(readAll().limits ?? {}) };
}

export function setPricing(pricing: PricingValues): PricingValues {
  writeAll({ pricing, limits: getLimits() });
  return pricing;
}

export function setLimits(limits: LimitsValues): LimitsValues {
  writeAll({ pricing: getPricing(), limits });
  return limits;
}

// How many drivers a tier allows (0 for "none" / unknown).
export function driverLimitForTier(tier: string): number {
  const l = getLimits();
  if (tier === "silver") return l.silver;
  if (tier === "gold") return l.gold;
  if (tier === "platinum") return l.platinum;
  return 0;
}
