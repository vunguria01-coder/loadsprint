import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Users, PackageCheck, DollarSign, ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";
import { ActiveLoads } from "@/components/active-loads";
import { GettingStarted } from "@/components/getting-started";
import { NewLoadButton } from "@/components/new-load-button";

export const metadata: Metadata = {
  title: "Home — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role === "admin") redirect("/admin");
  if (me.role !== "dispatcher") redirect("/loads");
  if (!hasAccess(me)) redirect("/pricing");

  const invites = getInvitesByRole(me.id, "driver");
  const myLoads = getLoadsByDispatcher(me.id);
  const emails = Array.from(new Set(invites.map((i) => i.email.toLowerCase())));
  const driverCount = emails.length;
  const driverOpts = emails.map((email) => ({ email, name: findByEmail(email)?.name || email }));

  const active = myLoads.filter((l) => l.status !== "Delivered" && l.status !== "Closed");
  const completed = myLoads.filter((l) => l.status === "Delivered" || l.status === "Closed");

  const activeLoads = active.map((l) => ({
    id: l.id,
    ref: l.ref,
    driverName: l.driverName,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
  }));

  const pct = me.commissionPct || 0;
  const earned = Math.round(
    (completed.reduce((s, l) => s + (l.loadRate || 0), 0) * pct) / 100
  );
  const showEarnings = pct > 0;

  const firstName = me.name?.split(" ")[0] || "there";

  return (
    <CabinetServer active="dashboard">
      <div className="wrap home-wrap">
        <div className="home-head">
          <div>
            <span className="eyebrow">Overview</span>
            <h2 className="h2">Welcome back, {firstName}</h2>
            <p className="lead">Everything that needs your attention, in one place.</p>
          </div>
          <div className="home-cta-row">
            <NewLoadButton drivers={driverOpts} />
            <Link href="/drivers" className="btn btn-ghost home-cta">
              <Users size={17} /> Manage drivers
            </Link>
          </div>
        </div>

        <div className="home-stats">
          <div className="home-stat sx-blue">
            <div className="hs-ic"><Package size={18} /></div>
            <div className="hs-val">{active.length}</div>
            <div className="hs-label">Active loads</div>
          </div>
          <div className="home-stat sx-sky">
            <div className="hs-ic"><Users size={18} /></div>
            <div className="hs-val">{driverCount}</div>
            <div className="hs-label">Drivers</div>
          </div>
          <div className="home-stat sx-green">
            <div className="hs-ic"><PackageCheck size={18} /></div>
            <div className="hs-val">{completed.length}</div>
            <div className="hs-label">Completed</div>
          </div>
          {showEarnings && (
            <div className="home-stat sx-emerald">
              <div className="hs-ic"><DollarSign size={18} /></div>
              <div className="hs-val">${earned.toLocaleString("en-US")}</div>
              <div className="hs-label">Your earnings</div>
            </div>
          )}
        </div>

        {myLoads.length === 0 && <GettingStarted />}

        {activeLoads.length > 0 ? (
          <ActiveLoads loads={activeLoads} />
        ) : (
          myLoads.length > 0 && (
            <div className="home-empty">
              <p>No active loads right now. Open a driver to create the next one.</p>
              <Link href="/drivers" className="home-empty-link">
                Go to drivers <ArrowRight size={15} />
              </Link>
            </div>
          )
        )}
      </div>
    </CabinetServer>
  );
}
