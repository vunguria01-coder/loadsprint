import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/guard";
import {
  ensureDemoLoadsFor,
  getLoadsByDispatcher,
  getLoadsByBrokerEmail,
  getLoadsByDriverEmail,
  getAllLoads,
  type Load,
} from "@/lib/loads";
import { AppHeader } from "@/components/app-header";
import { StatusChip } from "@/components/status-chip";

export const metadata: Metadata = {
  title: "Loads — LoadSprint",
  robots: { index: false, follow: false },
};

function LoadCard({ load }: { load: Load }) {
  return (
    <Link href={`/loads/${load.id}`} className="load-card">
      <div className="lc-top">
        <span className="lc-ref">{load.ref}</span>
        <StatusChip status={load.status} />
      </div>
      <div className="lc-route">
        <MapPin /> {load.originName} <ArrowRight size={15} /> {load.destName}
      </div>
      <div className="lc-sub">
        {load.documents.length} docs · {load.photos.length} photos ·{" "}
        {load.messages.length} messages
      </div>
    </Link>
  );
}

export default async function LoadsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if ((me.role === "dispatcher" || me.role === "broker") && me.tier === "none") {
    redirect("/pricing");
  }

  let loads: Load[] = [];
  if (me.role === "broker") {
    loads = getLoadsByBrokerEmail(me.email);
  } else if (me.role === "admin") {
    loads = getAllLoads();
  } else if (me.role === "driver") {
    loads = getLoadsByDriverEmail(me.email);
  } else {
    // dispatcher: seed demo data on first visit
    ensureDemoLoadsFor(me.id, me.name);
    loads = getLoadsByDispatcher(me.id);
  }

  // group by driver
  const groups = new Map<string, Load[]>();
  for (const l of loads) {
    const key = l.driverName || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <>
      <AppHeader back="/dashboard" backLabel="Dashboard" />
      <main className="loads-body">
        <div className="wrap">
          <h1 className="admin-h">Loads</h1>
          <p className="admin-sub">
            {me.role === "broker"
              ? "Loads where you are the broker."
              : "Open a driver, then open any load for full control."}
          </p>

          {loads.length === 0 && (
            <div className="empty">No loads yet.</div>
          )}

          {me.role === "broker"
            ? (
              <div className="load-cards">
                {loads.map((l) => (
                  <LoadCard key={l.id} load={l} />
                ))}
              </div>
            )
            : (
              [...groups.entries()].map(([driver, dloads]) => (
                <div className="driver-group" key={driver}>
                  <div className="dg-head">
                    <div className="dg-av">
                      {driver.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="dg-name">{driver}</div>
                      <div className="dg-meta">
                        {dloads.length} active load{dloads.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="load-cards">
                    {dloads.map((l) => (
                      <LoadCard key={l.id} load={l} />
                    ))}
                  </div>
                </div>
              ))
            )}
        </div>
      </main>
    </>
  );
}
