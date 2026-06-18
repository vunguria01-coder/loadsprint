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

/* ---------- admin account actions ---------- */
export const adminAccountSchema = z.object({
  userId: z.string().min(1),
  tier: z.enum(ACCOUNT_TIERS).optional(),
  canFreezeLocation: z.boolean().optional(),
});

/* ---------- driver invite (by dispatcher/admin) ---------- */
export const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
