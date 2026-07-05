import crypto from "crypto";

// Stateless 2FA: codes and trusted-device tokens are signed with AUTH_SECRET, so
// nothing is stored on disk (survives Railway redeploys). The actual code is only
// ever sent to the user's email; the challenge cookie holds only a keyed hash.

const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";

function hmac(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

function pack(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}
function unpack(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || hmac(body) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export const TWOFA_COOKIE = "ls_2fa";
export const TRUST_COOKIE = "ls_trust";
// Short-lived challenge for the "forgot password" flow. Kept separate from the
// 2FA cookie so a reset in progress can't be confused with a sign-in code.
export const RESET_COOKIE = "ls_reset";

// Generate a 6-digit numeric code.
export function genCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

// Build the challenge token to store in a short-lived cookie (default 10 min).
export function makeChallenge(email: string, code: string, minutes = 10): string {
  const e = email.trim().toLowerCase();
  return pack({
    e,
    exp: Date.now() + minutes * 60 * 1000,
    h: hmac(`${e}:${code}`),
  });
}

// Verify a submitted code against the challenge cookie.
export function verifyChallenge(token: string | undefined, email: string, code: string): boolean {
  const data = unpack(token);
  if (!data) return false;
  const e = email.trim().toLowerCase();
  if (data.e !== e) return false;
  if (typeof data.exp !== "number" || Date.now() > data.exp) return false;
  const expected = hmac(`${e}:${String(code).trim()}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(String(data.h)), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Long-lived "this device is trusted" token for a given email.
// Pass `days` to embed an expiry (used by the mobile app, which has no cookie
// maxAge to rely on). Without `days` the token never expires on its own.
export function makeTrust(email: string, days?: number): string {
  const payload: Record<string, unknown> = { e: email.trim().toLowerCase(), kind: "trust" };
  if (typeof days === "number") payload.exp = Date.now() + days * 24 * 60 * 60 * 1000;
  return pack(payload);
}

export function verifyTrust(token: string | undefined, email: string): boolean {
  const data = unpack(token);
  if (!data || data.kind !== "trust") return false;
  if (typeof data.exp === "number" && Date.now() > data.exp) return false;
  return data.e === email.trim().toLowerCase();
}
