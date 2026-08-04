import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { EmptyState } from "@/components/empty-state";
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
  // Dispatchers have a single canonical completed-loads screen ("Completed" →
  // /review). Send them there so History isn't a confusing duplicate.
  if (me.role === "dispatcher") redirect("/review");

  let loads: Load[] = [];
  if (me.role === "admin") loads = getAllLoads();
  else if (me.role === "broker") loads = getLoadsByBrokerEmail(me.email);
  else if (me.role === "driver") loads = getLoadsByDriverEmail(me.email);
  else loads = getLoadsByDispatcher(me.id);

  const done = loads
    .filter((l) => l.status === "Delivered" || l.status === "Closed")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <CabinetServer active="history">
        <div className="wrap">
          <header className="adm-head">
            <div className="adm-head-text">
              <h1 className="adm-title">History</h1>
              <p className="adm-subtitle">Delivered and closed loads.</p>
            </div>
          </header>
          {done.length === 0 ? (
            <EmptyState
              icon={<PackageCheck size={26} />}
              title="No completed loads yet"
              sub="Delivered and closed loads will appear here."
            />
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
      </CabinetServer>
  );
}
