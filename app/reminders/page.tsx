import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, AlertTriangle, Clock, Container } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getTrucksByOwner, computeReminders, type Reminder } from "@/lib/trucks";
import { CabinetServer } from "@/components/cabinet-server";

export const metadata: Metadata = {
  title: "Reminders — LoadSprint",
  robots: { index: false, follow: false },
};

function Row({ r }: { r: Reminder }) {
  const cls = r.status === "overdue" ? "bad" : "warn";
  return (
    <Link href={`/trucks/${r.truckId}`} className="rem-row">
      <span className={`rem-stripe ${cls}`} />
      <div className="rem-mid">
        <div className="rem-title">
          {r.label} <span className="rem-type">{r.type === "doc" ? "document" : "maintenance"}</span>
        </div>
        <div className="rem-truck"><Container size={13} /> {r.truckName}</div>
      </div>
      <span className={`ar-days ${cls}`}>{r.detail}</span>
    </Link>
  );
}

export default async function RemindersPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const ownerId = me.ownerId || me.id;
  const trucks = getTrucksByOwner(ownerId);
  const all = computeReminders(trucks, new Date());
  const overdue = all.filter((r) => r.status === "overdue");
  const soon = all.filter((r) => r.status === "soon");

  return (
    <CabinetServer active="reminders">
      <div className="wrap home-wrap">
        <div className="shead" style={{ marginBottom: 22 }}>
          <span className="eyebrow">Compliance</span>
          <h2 className="h2">
            <BellRing size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            Reminders
          </h2>
          <p className="lead">
            Documents about to expire and maintenance coming due across your fleet.
          </p>
        </div>

        <div className="home-stats" style={{ marginBottom: 8 }}>
          <div className={`home-stat ${overdue.length ? "sx-red" : "sx-green"}`}>
            <div className="hs-ic"><AlertTriangle size={18} /></div>
            <div className="hs-val">{overdue.length}</div>
            <div className="hs-label">Overdue</div>
          </div>
          <div className={`home-stat ${soon.length ? "sx-sky" : "sx-green"}`}>
            <div className="hs-ic"><Clock size={18} /></div>
            <div className="hs-val">{soon.length}</div>
            <div className="hs-label">Due soon</div>
          </div>
        </div>

        {overdue.length === 0 && soon.length === 0 ? (
          <div className="home-empty">
            {trucks.length === 0 ? (
              <p>No trucks yet. <Link className="home-empty-link" href="/trucks">Add a truck</Link> and log its documents &amp; service intervals to get reminders.</p>
            ) : (
              <p>Nothing due right now. 🎉 Add documents and maintenance intervals on each truck to track more.</p>
            )}
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="ins-section">
                <h3>Overdue</h3>
                <p className="ins-sub">Handle these now.</p>
                <div className="rem-list">{overdue.map((r, i) => <Row key={i} r={r} />)}</div>
              </div>
            )}
            {soon.length > 0 && (
              <div className="ins-section">
                <h3>Due soon</h3>
                <p className="ins-sub">Within 30 days or 1,500 miles.</p>
                <div className="rem-list">{soon.map((r, i) => <Row key={i} r={r} />)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </CabinetServer>
  );
}
