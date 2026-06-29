import { getUserById, updateUser, findByEmail } from "@/lib/auth";

// Shared subscription-grant logic, used by BOTH the Stripe webhook and the
// confirm-on-return endpoint. Keeping it in one place means a paid plan always
// receives the same tier + expiry no matter which path activates it.

const DAY_MS = 24 * 60 * 60 * 1000;

function resolveUser(userId?: string, email?: string) {
  if (userId) {
    const u = getUserById(userId);
    if (u) return u;
  }
  if (email) {
    const u = findByEmail(email);
    if (u) return u;
  }
  return undefined;
}

// Grant a tier with an absolute expiry of `durationDays` from now. Absolute (not
// additive) so confirming the same purchase twice can never stack extra time.
export function grantTier(
  userId: string | undefined,
  tier: string,
  durationDays: number,
  planId?: string,
  email?: string
) {
  const user = resolveUser(userId, email);
  if (!user) return undefined;
  const days = durationDays > 0 ? durationDays : 30;
  const expires = new Date(Date.now() + days * DAY_MS).toISOString();
  return updateUser(user.id, { tier: tier as never, tierExpiresAt: expires, planId });
}

// Monthly renewal: push the expiry one month past the later of now / current end.
export function extendOneMonth(userId: string, tier: string) {
  const user = getUserById(userId);
  if (!user) return undefined;
  const current = user.tierExpiresAt ? new Date(user.tierExpiresAt).getTime() : 0;
  const from = Math.max(Date.now(), current);
  const expires = new Date(from + 30 * DAY_MS).toISOString();
  return updateUser(userId, { tier: tier as never, tierExpiresAt: expires });
}
