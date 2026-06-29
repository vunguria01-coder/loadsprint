import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getLoadsByDispatcher, getAllLoads } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";
import { CalendarView, type CalLoad } from "@/components/calendar-view";

export const metadata: Metadata = {
  title: "Calendar — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function CalendarPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const all = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const loads: CalLoad[] = all.map((l) => ({
    id: l.id,
    ref: l.ref,
    route: `${l.originName} → ${l.destName}`,
    status: l.status,
    pickupDate: l.pickupDate,
    deliveryDate: l.deliveryDate,
    active: l.status !== "Delivered" && l.status !== "Closed",
  }));

  return (
    <CabinetServer active="calendar">
      <div className="wrap home-wrap">
        <div className="shead" style={{ marginBottom: 22 }}>
          <span className="eyebrow">Schedule</span>
          <h2 className="h2">
            <CalendarDays size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            Calendar
          </h2>
          <p className="lead">Pickups and deliveries across all your loads, by day.</p>
        </div>

        <CalendarView loads={loads} />
      </div>
    </CabinetServer>
  );
}
