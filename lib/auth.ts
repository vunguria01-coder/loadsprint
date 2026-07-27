import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Role, AccountTier } from "@/lib/schemas";
import { readJson, writeJsonAtomic } from "@/lib/json-store";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@loadsprint.com")
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin12345";
const ADMIN_NAME = process.env.ADMIN_NAME || "LoadSprint Admin";

export const SESSION_COOKIE = "ls_session";

export type AccountRole = Role | "admin" | "driver";

export type User = {
  id: string;
  name: string;
  company: string;
  email: string;
  role: AccountRole;
  tier: AccountTier;
  tierExpiresAt?: string; // ISO date; undefined = no expiry
  planId?: string; // last purchased billing plan id
  ownerId?: string; // for a sub-dispatcher: the id of the owner who invited them
  commissionPct?: number; // dispatcher's commission %, set by the owner (0..100)
  canFreezeLocation: boolean;
  freezeActive: boolean;
  canConfirmationPdf?: boolean; // admin-granted: clean rate-confirmation PDF tool
  salt: string;
  hash: string;
  createdAt: string;
};

export type SafeUser = Omit<User, "salt" | "hash">;

export type SessionData = {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
};

/* ---------- store (local JSON; swap for a DB in production) ---------- */
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");
}

function normalize(u: Partial<User>): User {
  return {
    // Spread first, then fill defaults. Listing the fields alone made this a
    // whitelist: `canConfirmationPdf` was missing from it, so every read
    // dropped the admin-granted PDF permission (the gate saw `undefined` and
    // answered 403) and the next saveUsers wrote the stripped row back to
    // disk, erasing the grant for good. Spreading keeps columns that only the
    // store knows about, including any added to User later.
    ...u,
    id: u.id ?? newId(),
    name: u.name ?? "",
    company: u.company ?? "",
    email: u.email ?? "",
    role: (u.role as AccountRole) ?? "broker",
    tier: (u.tier as AccountTier) ?? "none",
    tierExpiresAt: u.tierExpiresAt,
    planId: u.planId,
    ownerId: u.ownerId,
    commissionPct: u.commissionPct,
    canFreezeLocation: u.canFreezeLocation ?? false,
    freezeActive: u.freezeActive ?? false,
    salt: u.salt ?? "",
    hash: u.hash ?? "",
    createdAt: u.createdAt ?? new Date().toISOString(),
  };
}

export function getUsers(): User[] {
  ensureStore();
  const raw = readJson<Partial<User>[]>(USERS_FILE, []);
  return Array.isArray(raw) ? raw.map(normalize) : [];
}

// Every write goes through normalize too, not just every read: a row built by a
// caller (addUser, a merge in dedupeByEmail, a patch) can be missing columns the
// store knows about, and whatever lands here is what the next process reads back.
function saveUsers(users: Partial<User>[]) {
  ensureStore();
  writeJsonAtomic(USERS_FILE, users.map(normalize));
}

export function toSafe(u: User): SafeUser {
  const { salt: _s, hash: _h, ...safe } = u;
  void _s;
  void _h;
  return safe;
}

export function findByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return getUsers().find((u) => u.email === e);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}

export function addUser(u: User) {
  const users = getUsers();
  users.push(u);
  saveUsers(users);
}

export function updateUser(id: string, patch: Partial<User>): User | undefined {
  const users = getUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return undefined;
  // Keys absent from the patch keep their stored value (so a tier change never
  // touches an admin grant); keys present win, including an explicit `undefined`
  // that clears tierExpiresAt/planId. normalize keeps the merged row complete.
  users[i] = normalize({ ...users[i], ...patch, id: users[i].id });
  saveUsers(users);
  return users[i];
}

// Permanently remove a user account (used when a dispatcher removes a driver or
// an owner removes a sub-dispatcher). Returns true if a row was deleted.
export function deleteUser(id: string): boolean {
  const users = getUsers();
  const next = users.filter((u) => u.id !== id);
  if (next.length === users.length) return false;
  saveUsers(next);
  return true;
}

// All sub-dispatchers that belong to an owner.
export function getSubDispatchers(ownerId: string): User[] {
  return getUsers().filter((u) => u.role === "dispatcher" && u.ownerId === ownerId);
}

// The account whose subscription governs access/limits. A sub-dispatcher
// (ownerId set) is governed by the owner who pays; everyone else by themselves.
export function billingUser(user: User): User {
  if (user.role === "dispatcher" && user.ownerId) {
    return getUserById(user.ownerId) ?? user;
  }
  return user;
}

// Whether a user currently has working access, resolving owner inheritance for
// sub-dispatchers. Use this for page/route gates instead of hasActiveSub alone.
export function hasAccess(user: User): boolean {
  if (user.role === "admin" || user.role === "driver") return true;
  return hasActiveSub(billingUser(user));
}

/* ---------- admin seeding ---------- */
// Keeps the admin account in sync with ADMIN_EMAIL / ADMIN_PASSWORD on every
// start: creates it if missing, otherwise updates the password/role so you can
// always sign in with the credentials set in the environment.
/**
 * Email is the login key, so two rows sharing one is never valid — a duplicate
 * is always the residue of a torn read (see lib/json-store). Keep the oldest
 * row, since that is the one sessions and invites already point at, and fold in
 * any plan the newer rows picked up.
 */
function dedupeByEmail(): void {
  const users = getUsers();
  const byEmail = new Map<string, User>();
  let dupes = 0;
  for (const u of users) {
    const kept = byEmail.get(u.email);
    if (!kept) {
      byEmail.set(u.email, u);
      continue;
    }
    dupes++;
    const older = kept.createdAt <= u.createdAt ? kept : u;
    const newer = older === kept ? u : kept;
    // Never let the dedupe downgrade a paid account, and never let it drop a
    // grant an admin gave the row that loses: keep whichever side has it.
    byEmail.set(u.email, {
      ...older,
      tier: older.tier !== "none" ? older.tier : newer.tier,
      tierExpiresAt: older.tier !== "none" ? older.tierExpiresAt : newer.tierExpiresAt,
      planId: older.planId ?? newer.planId,
      canFreezeLocation: older.canFreezeLocation || newer.canFreezeLocation,
      canConfirmationPdf: older.canConfirmationPdf || newer.canConfirmationPdf,
    });
  }
  if (dupes > 0) saveUsers([...byEmail.values()]);
}

export function ensureSeed() {
  const { salt, hash } = hashPassword(ADMIN_PASSWORD);
  dedupeByEmail();
  const existing = findByEmail(ADMIN_EMAIL);
  if (!existing) {
    addUser({
      id: newId(),
      name: ADMIN_NAME,
      company: "LoadSprint",
      email: ADMIN_EMAIL,
      role: "admin",
      tier: "platinum",
      canFreezeLocation: true,
      freezeActive: false,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });
  } else {
    // Keep credentials/role in sync, but do NOT overwrite tier/planId — otherwise
    // a purchased plan would otherwise be reset to platinum on every restart.
    updateUser(existing.id, {
      role: "admin",
      canFreezeLocation: true,
      salt,
      hash,
    });
  }
}

export function isAdmin(session: SessionData | null): boolean {
  return session?.role === "admin";
}

// Days left on a subscription (null when no expiry is set). Can be negative.
export function subDaysLeft(user: {
  tierExpiresAt?: string;
}): number | null {
  if (!user.tierExpiresAt) return null;
  const ms = new Date(user.tierExpiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Whether a user currently has working access. Admin and driver always do.
// Brokers/dispatchers need a tier that isn't "none" and isn't past its expiry.
export function hasActiveSub(user: {
  role: AccountRole;
  tier: AccountTier;
  tierExpiresAt?: string;
}): boolean {
  if (user.role === "admin" || user.role === "driver") return true;
  if (user.tier === "none") return false;
  if (user.tierExpiresAt && new Date(user.tierExpiresAt).getTime() < Date.now())
    return false;
  return true;
}

/* ---------- password hashing (Node crypto, no extra deps) ---------- */
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return (
    candidate.length === stored.length &&
    crypto.timingSafeEqual(candidate, stored)
  );
}

/* ---------- signed session token (HMAC) ---------- */
function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined): SessionData | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SessionData;
  } catch {
    return null;
  }
}

export function newId() {
  return crypto.randomUUID();
}
