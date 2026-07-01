import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { DriverManager } from "@/components/driver-manager";
import { DriversList } from "@/components/drivers-list";
import { FleetMap } from "@/components/fleet-map";
import { GettingStarted } from "@/components/getting-started";
import { hasAccess, billingUser, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher } from "@/lib/loads";
import { getDriverGlobalLocations } from "@/lib/driver-location";
import { driverAllowance } from "@/lib/billing-plans";

export const metadata: Metadata = {
  title: "Drivers — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DriversPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const invites = getInvitesByRole(me.id, "driver");
  const myLoads = getLoadsByDispatcher(me.id);
  const emails = Array.from(new Set(invites.map((i) => i.email.toLowerCase())));
  const drivers = emails.map((email) => {
    const user = findByEmail(email);
    const loads = myLoads.filter((l) => l.driverEmail.toLowerCase() === email);
    const active = loads.filter((l) => l.status !== "Delivered" && l.status !== "Closed").length;
    // Build a search haystack: name, email, every load ref, broker name/email.
    const search = [
      user?.name || email,
      email,
      ...loads.map((l) => l.ref),
      ...loads.map((l) => l.brokerName),
      ...loads.map((l) => l.brokerEmail),
      ...loads.map((l) => l.billTo || ""),
    ]
      .join(" ")
      .toLowerCase();
    return {
      email,
      name: user?.name || email,
      joined: !!user,
      total: loads.length,
      active,
      search,
    };
  });

  // Last-known GPS for each driver (load-independent) → the fleet map.
  const locs = getDriverGlobalLocations(emails);
  const fleet = drivers
    .map((d) => {
      const p = locs[d.email.toLowerCase()];
      if (!p) return null;
      return {
        name: d.name,
        email: d.email,
        lat: p.lat,
        lng: p.lng,
        at: p.at,
        active: d.active > 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Driver allowance: how many the plan includes vs how many are used.
  const usedDrivers = emails.length;
  const bu = billingUser(me);
  const planLimit =
    me.role === "admin" ? Infinity : driverAllowance(bu.planId, bu.tier);
  const canAddMore = planLimit === Infinity || usedDrivers < planLimit;

  // This dispatcher's own earnings: their commission of their delivered loads.
  const myPct = me.commissionPct || 0;
  const myDeliveredTotal = myLoads
    .filter((l) => l.status === "Delivered" || l.status === "Closed")
    .reduce((sum, l) => sum + (l.loadRate || 0), 0);
  const myEarned = Math.round((myDeliveredTotal * myPct) / 100);
  const showEarnings = me.role === "dispatcher" && myPct > 0;

  return (
    <CabinetServer active="drivers">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="shead" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">Dispatch</span>
              <h2 className="h2">
                <Users size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
                Drivers
              </h2>
              <p className="lead">Tap a driver to see their loads, GPS, and create a new load.</p>
            </div>
            <DriverManager invites={invites} />
          </div>

          {showEarnings && (
            <div className="earn-card">
              <div className="earn-label">Your earnings</div>
              <div className="earn-amount">${myEarned.toLocaleString("en-US")}</div>
              <div className="earn-sub">from delivered loads</div>
            </div>
          )}

          <div className="seat-meter">
            <div className="seat-info">
              <span className="seat-count">
                {usedDrivers}
                <i> / {planLimit === Infinity ? "∞" : planLimit}</i>
              </span>
              <span className="seat-label">drivers used</span>
            </div>
            <div className="seat-right">
              {planLimit === Infinity ? (
                <span className="seat-ok">Unlimited on your plan</span>
              ) : canAddMore ? (
                <span className="seat-ok">
                  You can add {planLimit - usedDrivers} more
                </span>
              ) : (
                <span className="seat-full">
                  Limit reached — extra drivers are $10/mo each
                </span>
              )}
            </div>
          </div>

          {myLoads.length === 0 && <GettingStarted />}

          <FleetMap drivers={fleet} />

          {drivers.length === 0 ? (
            <p className="px">
              No drivers yet. Use “Add driver” to invite your first one.
            </p>
          ) : (
            <DriversList drivers={drivers} />
          )}
        </div>
      </CabinetServer>
  );
}
