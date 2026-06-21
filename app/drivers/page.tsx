import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users, ChevronRight } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
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
    return {
      email,
      name: user?.name || email,
      joined: !!user,
      total: loads.length,
      active,
    };
  });

  return (
    <CabinetServer active="drivers">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="shead" style={{ marginBottom: 20 }}>
            <span className="eyebrow">Dispatch</span>
            <h2 className="h2">
              <Users size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
              Drivers
            </h2>
            <p className="lead">Tap a driver to see their loads, GPS, and create a new load.</p>
          </div>

          {drivers.length === 0 ? (
            <p className="px">
              No drivers yet. Go to your <Link href="/dashboard" className="link">dashboard</Link> and use
              “Add a driver” to invite one.
            </p>
          ) : (
            <div className="load-list">
              {drivers.map((d) => (
                <Link
                  key={d.email}
                  href={`/drivers/${encodeURIComponent(d.email)}`}
                  className="load-card"
                  style={{ textDecoration: "none" }}
                >
                  <div className="lc-main">
                    <div className="lc-ref">{d.name}</div>
                    <div className="lc-route">{d.email}</div>
                    <div className="px" style={{ marginTop: 4 }}>
                      {d.active} active · {d.total} total {d.joined ? "" : "· invite pending"}
                    </div>
                  </div>
                  <ChevronRight />
                </Link>
              ))}
            </div>
          )}
        </div>
      </CabinetServer>
  );
}
