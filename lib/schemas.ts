import { z } from "zod";

export const quoteSchema = z.object({
  pickup: z.string().min(2, "Enter a pickup location"),
  delivery: z.string().min(2, "Enter a delivery location"),
  freight: z.string().min(1, "Choose a freight type"),
  trailer: z.string().min(1, "Choose a trailer type"),
  weight: z.coerce.number({ invalid_type_error: "Enter the weight" }).positive("Enter the weight"),
  date: z.string().min(1, "Pick a date"),
  email: z.string().email("Enter a valid email"),
});
export type QuoteValues = z.infer<typeof quoteSchema>;

export const carrierSchema = z.object({
  company: z.string().min(2, "Enter your company name"),
  mc: z.string().min(2, "Enter your MC number"),
  dot: z.string().min(2, "Enter your DOT number"),
  contact: z.string().min(2, "Enter a contact name"),
  phone: z.string().min(7, "Enter a phone number"),
  email: z.string().email("Enter a valid email"),
});
export type CarrierValues = z.infer<typeof carrierSchema>;

export const contactSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  company: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  freightType: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  message: z.string().min(2, "Add a short message"),
});
export type ContactValues = z.infer<typeof contactSchema>;

export const ROLES = ["broker", "dispatcher"] as const;
export type Role = (typeof ROLES)[number];

export const registerSchema = z
  .object({
    role: z.enum(ROLES, { required_error: "Choose a role" }),
    name: z.string().min(2, "Enter your full name"),
    company: z.string().optional(),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    agree: z.boolean().refine((v) => v === true, "You must accept the terms"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginValues = z.infer<typeof loginSchema>;

/* ---------- password reset (forgot password) ---------- */
export const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z.object({
  email: z.string().email("Enter a valid email"),
  code: z.string().length(6, "Enter the 6-digit code"),
  password: z.string().min(8, "At least 8 characters"),
});
export type ResetValues = z.infer<typeof resetSchema>;

/* ---------- subscriptions ---------- */
export const TIERS = ["silver", "gold", "platinum"] as const;
export type Tier = (typeof TIERS)[number];
export type AccountTier = "none" | Tier;

export const ACCOUNT_TIERS = ["none", "silver", "gold", "platinum"] as const;

export const subscribeSchema = z.object({
  tier: z.enum(TIERS),
});

export const pricingSchema = z.object({
  silver: z.coerce.number().min(0),
  gold: z.coerce.number().min(0),
  platinum: z.coerce.number().min(0),
  currency: z.string().min(1).max(4),
  period: z.string().min(1).max(12),
});
export type PricingValues = z.infer<typeof pricingSchema>;

export const limitsSchema = z.object({
  silver: z.coerce.number().int().min(0),
  gold: z.coerce.number().int().min(0),
  platinum: z.coerce.number().int().min(0),
  extraDriverPrice: z.coerce.number().min(0),
});
export type LimitsValues = z.infer<typeof limitsSchema>;

export const invoiceProfileSchema = z.object({
  companyName: z.string().max(120).optional().default(""),
  address: z.string().max(240).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  email: z.string().max(120).optional().default(""),
  payTerms: z.string().max(120).optional().default(""),
  notes: z.string().max(400).optional().default(""),
  // Company logo printed top-left on every invoice. Stored as a data URL so the
  // whole profile stays in one JSON file — the form shrinks it before saving.
  logoDataUrl: z
    .string()
    .max(700_000)
    .refine((v) => v === "" || v.startsWith("data:image/"), "Logo must be an image")
    .optional()
    .default(""),
  taxId: z.string().max(60).optional().default(""), // "Tax Registration #"
  terms: z.string().max(40).optional().default("NET 30"),
  termsDays: z.coerce.number().int().min(0).max(365).optional().default(30),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
  // Running invoice counter — the next invoice created gets this number.
  nextInvoiceNumber: z.coerce.number().int().min(1).max(9_999_999).optional().default(1001),
});
export type InvoiceProfile = z.infer<typeof invoiceProfileSchema>;

/* ---------- admin account actions ---------- */
export const adminAccountSchema = z.object({
  userId: z.string().min(1),
  tier: z.enum(ACCOUNT_TIERS).optional(),
  days: z.coerce.number().int().min(0).optional(),
  planId: z.string().max(40).optional(),
  canFreezeLocation: z.boolean().optional(),
  canConfirmationPdf: z.boolean().optional(),
});

/* ---------- driver invite (by dispatcher/admin) ---------- */
export const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

/* ---------- driver load-search profile ---------- */
// Empty string / undefined on any field means "no filter" on that
// dimension — this schema only trims and bounds what was actually typed,
// it never invents a default the dispatcher didn't set. The preprocess
// turns a blank textbox ("") into undefined BEFORE z.coerce.number() runs,
// since Number("") is 0, not undefined — without it, clearing a field
// would silently save a real 0 filter instead of "no filter."
const optionalNumber = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0).max(max).optional()
  );

export const driverSearchProfileSchema = z.object({
  equipment: z.string().max(40).optional().default(""),
  trailerLengthFt: optionalNumber(60),
  deadheadRadiusMi: optionalNumber(2000),
  preferredDirections: z.array(z.string().max(4)).max(8).optional().default([]),
  minRatePerMile: optionalNumber(50),
});
export type DriverSearchProfileValues = z.infer<typeof driverSearchProfileSchema>;

/* ---------- load-board source connections ---------- */
export const loadSourceConnectSchema = z.object({
  provider: z.enum(["dat", "123loadboard", "truckstop", "uber_freight"]),
  // Whatever the provider's credential looks like today (API key, or a
  // "key:secret" pair typed as one string) — scaffolding only, no real
  // provider call is made against this value yet.
  secret: z.string().min(1, "Enter a value").max(4000),
});
export type LoadSourceConnectValues = z.infer<typeof loadSourceConnectSchema>;

/* ---------- ELD connections ---------- */
export const eldConnectSchema = z.object({
  provider: z.enum(["motive", "samsara", "geotab", "verizon_connect"]),
  // Whatever the provider's credential looks like (API key, OAuth client
  // secret, database+username string, etc.) — scaffolding only, no real
  // ELD call is made against this value yet.
  secret: z.string().min(1, "Enter a value").max(4000),
});
export type EldConnectValues = z.infer<typeof eldConnectSchema>;

/* ---------- ELD driver link ---------- */
export const eldDriverLinkSchema = z.object({
  email: z.string().email("Enter a valid email"),
  provider: z.enum(["motive", "samsara", "geotab", "verizon_connect"]),
  // Only an identifier — never trusted as-is. lib/eld-driver-links.ts
  // re-verifies it against a fresh listDrivers() call before saving
  // anything.
  externalDriverId: z.string().min(1, "Choose an external driver").max(200),
});
export type EldDriverLinkValues = z.infer<typeof eldDriverLinkSchema>;

/* ---------- load-board provider policy (admin-only) ---------- */
// provider is validated separately (against LOAD_SOURCE_PROVIDERS) in the
// route before this ever runs, so it isn't re-declared here.
export const loadProviderPolicyInputSchema = z.object({
  status: z.enum(["pending", "approved", "revoked"]),
  // A reference number into wherever the actual signed agreement lives —
  // never the agreement text itself, so no length ceiling beyond "not a
  // pasted document."
  agreementRef: z.string().max(200).nullable().optional().default(null),
  approvedAt: z.string().max(40).nullable().optional().default(null),
  expiresAt: z.string().max(40).nullable().optional().default(null),
  allowFetch: z.boolean(),
  allowStore: z.boolean(),
  allowDisplay: z.boolean(),
  cacheTtlSeconds: z.coerce.number().int().min(0).max(86_400),
  refreshIntervalSeconds: z.coerce.number().int().min(0).max(86_400),
  allowBrokerContactStorage: z.boolean(),
});
export type LoadProviderPolicyInput = z.infer<typeof loadProviderPolicyInputSchema>;
