// Shared between the driver card's ELD panel and the Drivers list rows —
// they read the same snapshot shape (single vs batch), so the state names,
// duty labels, and number formatting live here once instead of twice
// drifting apart.
export type EldStatusState =
  | "not_linked"
  | "not_connected"
  | "not_verified"
  | "no_data"
  | "available"
  | "temporarily_unavailable";

export const ELD_DUTY_LABELS: Record<string, string> = {
  off_duty: "Off duty",
  sleeper: "Sleeper berth",
  driving: "Driving",
  on_duty: "On duty",
  yard_move: "Yard move",
  personal_conveyance: "Personal conveyance",
  unknown: "Unknown",
};

const NOT_AVAILABLE = "Not available";

// 0 is a real, meaningful value (out of drive time right now) — only a
// missing snapshot field (null) is "Not available". Never conflate the two.
export function fmtEldMin(v: number | null): string {
  if (v == null) return NOT_AVAILABLE;
  const h = Math.floor(v / 60);
  const m = v % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Deliberately exact ("Updated Xm ago"), not a vague "Live" badge — no ELD
// provider's sync cadence is agreed yet, so this only ever states what's
// actually known: when LoadSprint last received this snapshot.
export function fmtEldUpdatedAgo(iso: string | null): string {
  if (!iso) return NOT_AVAILABLE;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return NOT_AVAILABLE;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}
