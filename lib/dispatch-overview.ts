import type { Load, LoadStatus } from "@/lib/loads";
import { getDriverGlobalLocation } from "@/lib/driver-location";

/**
 * Turns a dispatcher's raw loads into everything the dashboard needs: the four
 * operational stat cards, per-load display rows (with derived status/urgency,
 * appointment and ETA text), and a prioritized list of "Today's Alerts".
 *
 * All output is plain JSON so it can cross the server→client boundary into the
 * DispatchBoard component. Derivation (late / appointment-soon) is time-based
 * off precise appointment timestamps when present; loads without them simply
 * never flag as late or soon.
 */

export type BadgeTone = "green" | "blue" | "sky" | "yellow" | "orange" | "red" | "gray";
export type AlertTone = "red" | "orange" | "blue" | "green" | "teal";

export type DispatchLoad = {
  id: string;
  ref: string;
  origin: string;
  dest: string;
  driverName: string;
  truckNumber?: string;
  trailerNumber?: string;
  brokerName?: string;
  status: LoadStatus;
  filterKey: string; // status, or "Delayed" when derived-late
  badgeLabel: string;
  badgeTone: BadgeTone;
  pickupAppt?: string;
  deliveryAppt?: string;
  etaText?: string;
  distanceText?: string;
  delayed: boolean;
  apptSoon: boolean;
  sort: number; // urgency sort key (lower = more urgent)
};

export type DispatchAlert = {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  loadId?: string;
  loadRef?: string;
};

export type StatCard = {
  key: string;
  icon: "loads" | "drivers" | "deliveries" | "attention";
  accent: "blue" | "sky" | "green" | "amber" | "red";
  value: number;
  prefix?: string;
  label: string;
  sub: string;
  subTone?: "muted" | "green" | "amber" | "red";
};

export type DispatchOverview = {
  stats: StatCard[];
  loads: DispatchLoad[];
  alerts: DispatchAlert[];
  filters: { key: string; label: string; count: number }[];
};

const HOUR = 3600 * 1000;
const DONE = (s: LoadStatus) => s === "Delivered" || s === "Closed";

function fmtAppt(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d ${h % 24}h`;
}

function fmtEta(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return fmtDuration(seconds * 1000);
}

function fmtMiles(meters?: number): string | undefined {
  if (!meters || meters <= 0) return undefined;
  return `${Math.round(meters / 1609).toLocaleString("en-US")} mi`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// The appointment that matters right now: pickup while still Assigned, otherwise delivery.
function relevantAppt(l: Load): string | undefined {
  if (l.status === "Assigned") return l.pickupApptAt || l.deliveryApptAt;
  return l.deliveryApptAt || l.pickupApptAt;
}

const SORT: Record<LoadStatus, number> = {
  "At Delivery": 2,
  "In Transit": 3,
  "Picked Up": 4,
  Assigned: 5,
  Delivered: 8,
  Closed: 9,
};

export function buildDispatchOverview(loads: Load[]): DispatchOverview {
  const now = new Date();
  const nowMs = now.getTime();

  // ---- per-load derivation ----
  const rows: DispatchLoad[] = [];
  for (const l of loads) {
    if (l.status === "Closed") continue; // closed loads leave the operational board
    const appt = relevantAppt(l);
    const apptMs = appt ? new Date(appt).getTime() : NaN;
    const delayed = !DONE(l.status) && !isNaN(apptMs) && apptMs < nowMs;
    const apptSoon =
      !DONE(l.status) && !isNaN(apptMs) && apptMs - nowMs > 0 && apptMs - nowMs <= 2 * HOUR;

    let badgeLabel: string = l.status;
    let badgeTone: BadgeTone = "gray";
    if (DONE(l.status)) {
      badgeLabel = "Delivered";
      badgeTone = "green";
    } else if (delayed) {
      badgeLabel = "Delayed";
      badgeTone = "red";
    } else if (apptSoon) {
      badgeLabel = "Appt Soon";
      badgeTone = "orange";
    } else if (l.status === "Assigned") {
      badgeTone = "gray";
    } else if (l.status === "Picked Up") {
      badgeTone = "blue";
    } else if (l.status === "In Transit") {
      badgeTone = "sky";
    } else if (l.status === "At Delivery") {
      badgeTone = "yellow";
    }

    const sort = delayed ? 0 : apptSoon ? 1 : SORT[l.status] ?? 6;

    rows.push({
      id: l.id,
      ref: l.ref,
      origin: l.originName,
      dest: l.destName,
      driverName: l.driverName,
      truckNumber: l.truckNumber,
      trailerNumber: l.trailerNumber,
      brokerName: l.brokerName || undefined,
      status: l.status,
      filterKey: delayed ? "Delayed" : l.status,
      badgeLabel,
      badgeTone,
      pickupAppt: fmtAppt(l.pickupApptAt),
      deliveryAppt: fmtAppt(l.deliveryApptAt),
      etaText: fmtEta(l.etaSeconds),
      distanceText: fmtMiles(l.remainingMeters),
      delayed,
      apptSoon,
      sort,
    });
  }
  rows.sort((a, b) => a.sort - b.sort || a.ref.localeCompare(b.ref));

  const active = loads.filter((l) => !DONE(l.status));

  // ---- stat cards ----
  const assignedToday = loads.filter((l) => {
    const c = new Date(l.createdAt);
    return !isNaN(c.getTime()) && isSameDay(c, now);
  }).length;

  const dutyEmails = new Set(active.map((l) => l.driverEmail.toLowerCase()));
  let onlineCount = 0;
  for (const email of dutyEmails) {
    const ping = getDriverGlobalLocation(email);
    if (ping && nowMs - new Date(ping.at).getTime() <= 15 * 60 * 1000) onlineCount++;
  }

  const deliveriesToday = active.filter((l) => {
    if (l.deliveryApptAt) {
      const d = new Date(l.deliveryApptAt);
      return !isNaN(d.getTime()) && isSameDay(d, now);
    }
    if (l.deliveryDate) return l.deliveryDate === ymd(now);
    return false;
  }).length;

  const upcomingDeliveries = active
    .map((l) => (l.deliveryApptAt ? new Date(l.deliveryApptAt).getTime() : NaN))
    .filter((t) => !isNaN(t) && t > nowMs)
    .sort((a, b) => a - b);
  const nextDeliverySub =
    upcomingDeliveries.length > 0
      ? `Next delivery in ${fmtDuration(upcomingDeliveries[0] - nowMs)}`
      : deliveriesToday > 0
      ? "On the road now"
      : "None scheduled";

  const attentionRows = rows.filter((r) => r.delayed || r.apptSoon);
  const anyLate = attentionRows.some((r) => r.delayed);
  const attentionSub =
    attentionRows.length === 0
      ? "All on schedule"
      : anyLate
      ? "Late appointment"
      : "Appointment soon";

  const stats: StatCard[] = [
    {
      key: "active",
      icon: "loads",
      accent: "blue",
      value: active.length,
      label: "Active Loads",
      sub: assignedToday > 0 ? `+${assignedToday} assigned today` : "No new loads today",
      subTone: assignedToday > 0 ? "green" : "muted",
    },
    {
      key: "drivers",
      icon: "drivers",
      accent: "sky",
      value: dutyEmails.size,
      label: "Drivers On Duty",
      sub: onlineCount > 0 ? `${onlineCount} online now` : "No live GPS",
      subTone: onlineCount > 0 ? "green" : "muted",
    },
    {
      key: "deliveries",
      icon: "deliveries",
      accent: "green",
      value: deliveriesToday,
      label: "Deliveries Today",
      sub: nextDeliverySub,
      subTone: "muted",
    },
    {
      key: "attention",
      icon: "attention",
      accent: attentionRows.length > 0 ? (anyLate ? "red" : "amber") : "green",
      value: attentionRows.length,
      label: "Requires Attention",
      sub: attentionSub,
      subTone: attentionRows.length > 0 ? (anyLate ? "red" : "amber") : "green",
    },
  ];

  // ---- filters (with live counts) ----
  const FILTER_DEFS: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Assigned", label: "Assigned" },
    { key: "Picked Up", label: "Picked Up" },
    { key: "In Transit", label: "In Transit" },
    { key: "At Delivery", label: "At Delivery" },
    { key: "Delivered", label: "Delivered" },
    { key: "Delayed", label: "Delayed" },
  ];
  const filters = FILTER_DEFS.map((f) => ({
    ...f,
    count:
      f.key === "all"
        ? rows.length
        : rows.filter((r) => r.filterKey === f.key).length,
  })).filter((f) => f.key === "all" || f.count > 0);

  // ---- alerts ----
  const alerts: DispatchAlert[] = [];
  for (const l of loads) {
    if (l.status === "Closed") continue;
    const routeRef = `${l.ref} · ${l.originName} → ${l.destName}`;
    const appt = relevantAppt(l);
    const apptMs = appt ? new Date(appt).getTime() : NaN;

    if (!DONE(l.status) && !isNaN(apptMs) && apptMs < nowMs) {
      alerts.push({
        id: `late-${l.id}`,
        tone: "red",
        title: "Driver running late",
        detail: `${routeRef} — appointment ${fmtDuration(nowMs - apptMs)} overdue`,
        loadId: l.id,
        loadRef: l.ref,
      });
    } else if (
      !DONE(l.status) &&
      !isNaN(apptMs) &&
      apptMs - nowMs > 0 &&
      apptMs - nowMs <= 2 * HOUR
    ) {
      alerts.push({
        id: `soon-${l.id}`,
        tone: "orange",
        title: `Appointment in ${fmtDuration(apptMs - nowMs)}`,
        detail: routeRef,
        loadId: l.id,
        loadRef: l.ref,
      });
    }

    // Unread broker message (from the broker's side, dispatcher hasn't opened it).
    const brokerMsg = [...(l.messages || [])]
      .reverse()
      .find((m) => m.authorRole === "broker" && !m.readBy.includes(l.dispatcherId));
    if (brokerMsg) {
      alerts.push({
        id: `msg-${brokerMsg.id}`,
        tone: "blue",
        title: "Broker sent a new message",
        detail: `${l.ref} — ${l.brokerName || "Broker"}`,
        loadId: l.id,
        loadRef: l.ref,
      });
    }

    // Recent POD upload (last 24h).
    const pod = (l.documents || [])
      .filter((d) => d.type === "pod")
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))[0];
    if (pod && nowMs - new Date(pod.uploadedAt).getTime() <= 24 * HOUR) {
      alerts.push({
        id: `pod-${pod.id}`,
        tone: "green",
        title: "POD uploaded",
        detail: `${l.ref} — ${l.destName}`,
        loadId: l.id,
        loadRef: l.ref,
      });
    }

    // Driver checked in (fresh GPS in the last 20 min) for a moving load.
    if (!DONE(l.status)) {
      const ping = getDriverGlobalLocation(l.driverEmail);
      if (ping && nowMs - new Date(ping.at).getTime() <= 20 * 60 * 1000) {
        alerts.push({
          id: `checkin-${l.id}`,
          tone: "teal",
          title: "Driver checked in",
          detail: `${l.driverName} — ${l.ref}`,
          loadId: l.id,
          loadRef: l.ref,
        });
      }
    }
  }
  const tonePriority: Record<AlertTone, number> = {
    red: 0,
    orange: 1,
    blue: 2,
    green: 3,
    teal: 4,
  };
  alerts.sort((a, b) => tonePriority[a.tone] - tonePriority[b.tone]);

  return { stats, loads: rows, alerts: alerts.slice(0, 6), filters };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
