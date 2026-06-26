import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { DriverManager } from "@/components/driver-manager";
import { DriversList } from "@/components/drivers-list";
import { hasActiveSub, findByEmail } from "@/lib/auth";
import { getInvitesBy } from "@/lib/invites";
import { getLoadsByDispatcher } from "@/lib/loads";

export const metadata: Metadata = {
  title: "Drivers — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DriversPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasActiveSub(me)) redirect("/pricing");

  const invites = getInvitesBy(me.id);
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
