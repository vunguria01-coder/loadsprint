import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const INVITES_FILE = path.join(DATA_DIR, "invites.json");

export type DriverInvite = {
  id: string;
  email: string;
  code: string;
  createdBy: string; // user id
  createdByName: string;
  status: "pending" | "claimed";
  createdAt: string;
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INVITES_FILE)) fs.writeFileSync(INVITES_FILE, "[]", "utf8");
}

export function getInvites(): DriverInvite[] {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(INVITES_FILE, "utf8")) as DriverInvite[];
  } catch {
    return [];
  }
}

function save(invites: DriverInvite[]) {
  ensure();
  fs.writeFileSync(INVITES_FILE, JSON.stringify(invites, null, 2), "utf8");
}

function genCode() {
  // human-friendly 8-char code, e.g. "K7P2-9QXM"
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[crypto.randomInt(alphabet.length)];
    if (i === 3) out += "-";
  }
  return out;
}

export function createInvite(
  email: string,
  createdBy: string,
  createdByName: string
): DriverInvite {
  const invites = getInvites();
  const invite: DriverInvite = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    code: genCode(),
    createdBy,
    createdByName,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  invites.push(invite);
  save(invites);
  return invite;
}

export function getInvitesBy(userId: string): DriverInvite[] {
  return getInvites()
    .filter((i) => i.createdBy === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Used by the future mobile app to validate a code the driver entered.
export function verifyCode(code: string): DriverInvite | undefined {
  return getInvites().find(
    (i) => i.code === code.trim().toUpperCase() && i.status === "pending"
  );
}

// Mark an invite as claimed (driver finished registration in the app).
export function claimInvite(code: string): DriverInvite | undefined {
  const invites = getInvites();
  const inv = invites.find(
    (i) => i.code === code.trim().toUpperCase() && i.status === "pending"
  );
  if (!inv) return undefined;
  inv.status = "claimed";
  save(invites);
  return inv;
}

// Remove an invite (only the dispatcher who created it, or admin via bypass).
export function deleteInvite(id: string, userId: string, isAdmin = false): boolean {
  const invites = getInvites();
  const inv = invites.find((i) => i.id === id);
  if (!inv) return false;
  if (!isAdmin && inv.createdBy !== userId) return false;
  save(invites.filter((i) => i.id !== id));
  return true;
}
