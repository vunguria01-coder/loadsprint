import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { AppHeader } from "@/components/app-header";
import {
  getLoadsByDispatcher,
  getLoadsByBrokerEmail,
  getLoadsByDriverEmail,
  getAllLoads,
  type Load,
} from "@/lib/loads";

export const metadata: Metadata = {
  title: "History — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function HistoryPage() {
  const me = await currentUser();
  if (!me) redirect("/login");

  let loads: Load[] = [];
  if (me.role === "admin") loads = getAllLoads();
  else if (me.role === "broker") loads = getLoadsByBrokerEmail(me.email);
  else if (me.role === "driver") loads = getLoadsByDriverEmail(me.email);
  else loads = getLoadsByDispatcher(me.id);

  const done = loads
    .filter((l) => l.status === "Delivered" || l.status === "Closed")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <AppHeader back="/loads" backLabel="Loadboard" role={me.role} />
      <main className="dash">
        <div className="wrap">
          <div className="shead" style={{ marginBottom: 20 }}>
            <span className="eyebrow">Completed</span>
            <h2 className="h2">History</h2>
            <p className="lead">Delivered and closed loads.</p>
          </div>
          {done.length === 0 ? (
            <p className="px">No completed loads yet.</p>
          ) : (
            <div className="load-list">
              {done.map((l) => (
                <Link key={l.id} href={`/loads/${l.id}`} className="load-card" style={{ textDecoration: "none" }}>
                  <div className="lc-main">
                    <div className="lc-top">
                      <span className="lc-ref">{l.ref}</span>
                      <span className="status-chip">{l.status}</span>
                    </div>
                    <div className="lc-route">{l.originName} → {l.destName}</div>
                    <div className="px" style={{ marginTop: 4 }}>Driver: {l.driverName || l.driverEmail}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
