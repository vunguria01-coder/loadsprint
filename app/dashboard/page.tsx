import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import Link from "next/link";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { homeHref } from "@/lib/home-href";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher } from "@/lib/loads";
import { buildDispatchOverview } from "@/lib/dispatch-overview";
import { CabinetServer } from "@/components/cabinet-server";
import { DispatchBoard } from "@/components/dispatch-board";
import { GettingStarted } from "@/components/getting-started";
import { NewLoadButton } from "@/components/new-load-button";

export const metadata: Metadata = {
  title: "Home — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  // Same rule as every "Home"/"Dashboard" link in the app — keep it in the
  // helper only, so this page and the links can't drift apart.
  const home = homeHref(me.role);
  if (home !== "/dashboard") redirect(home);
  if (!hasAccess(me)) redirect("/pricing");

  const invites = getInvitesByRole(me.id, "driver");
  const myLoads = getLoadsByDispatcher(me.id);
  const emails = Array.from(new Set(invites.map((i) => i.email.toLowerCase())));
  const driverOpts = emails.map((email) => ({ email, name: findByEmail(email)?.name || email }));

  const overview = buildDispatchOverview(myLoads);
  const firstName = me.name?.split(" ")[0] || "there";

  return (
    <CabinetServer active="dashboard">
      <div className="wrap home-wrap">
        <div className="home-head">
          <div>
            <span className="eyebrow">Dispatch board</span>
            <h2 className="h2">Welcome back, {firstName}</h2>
            <p className="lead">Live status of every driver and load — at a glance.</p>
          </div>
          <div className="home-cta-row">
            <NewLoadButton drivers={driverOpts} />
            <Link href="/drivers" className="btn btn-ghost home-cta">
              <Users size={17} /> Manage drivers
            </Link>
          </div>
        </div>

        {myLoads.length === 0 && <GettingStarted />}

        <DispatchBoard
          stats={overview.stats}
          loads={overview.loads}
          alerts={overview.alerts}
          filters={overview.filters}
        />
      </div>
    </CabinetServer>
  );
}
