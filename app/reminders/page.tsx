import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, AlertTriangle, Clock } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getTrucksByOwner, computeReminders } from "@/lib/trucks";
import { CabinetServer } from "@/components/cabinet-server";
import { RemindersList, type ReminderRow } from "@/components/reminders-list";

export const metadata: Metadata = {
  title: "Reminders — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function RemindersPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const ownerId = me.ownerId || me.id;
  const trucks = getTrucksByOwner(ownerId);
  const trucksById = new Map(trucks.map((t) => [t.id, t]));
  const all = computeReminders(trucks, new Date());

  const rows: ReminderRow[] = all.map((r) => {
    const t = trucksById.get(r.truckId);
    // Mileage-based maintenance has no calendar "today" — only a document can
    // expire on a specific date, so that's the only kind that lands there.
    const group: ReminderRow["group"] =
      r.status === "overdue"
        ? "overdue"
        : r.type === "doc" && r.detail === "expires today"
        ? "today"
        : "soon";
    return {
      truckId: r.truckId,
      truckName: r.truckName,
      type: r.type,
      label: r.label,
      status: r.status,
      detail: r.detail,
      group,
      search: [r.truckName, t?.unit, t?.plate, r.label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const overdue = rows.filter((r) => r.group === "overdue");
  const today = rows.filter((r) => r.group === "today");
  const soon = rows.filter((r) => r.group === "soon");

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
          <div className={`home-stat ${today.length ? "sx-blue" : "sx-green"}`}>
            <div className="hs-ic"><Clock size={18} /></div>
            <div className="hs-val">{today.length}</div>
            <div className="hs-label">Today</div>
          </div>
          <div className={`home-stat ${soon.length ? "sx-sky" : "sx-green"}`}>
            <div className="hs-ic"><Clock size={18} /></div>
            <div className="hs-val">{soon.length}</div>
            <div className="hs-label">Upcoming</div>
          </div>
        </div>

        {overdue.length === 0 && today.length === 0 && soon.length === 0 ? (
          <div className="home-empty">
            {trucks.length === 0 ? (
              <p>No trucks yet. <Link className="home-empty-link" href="/trucks">Add a truck</Link> and log its documents &amp; service intervals to get reminders.</p>
            ) : (
              <p>Nothing due right now. 🎉 Add documents and maintenance intervals on each truck to track more.</p>
            )}
          </div>
        ) : (
          <RemindersList rows={rows} />
        )}
      </div>
    </CabinetServer>
  );
}
