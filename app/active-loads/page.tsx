import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess } from "@/lib/auth";
import { getLoadsByDispatcher, getAllLoads } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";
import { ActiveLoads } from "@/components/active-loads";

export const metadata: Metadata = {
  title: "Active loads — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function ActiveLoadsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const all = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const rows = all
    .filter((l) => l.status !== "Delivered" && l.status !== "Closed")
    .map((l) => ({
      id: l.id,
      ref: l.ref,
      driverName: l.driverName,
      originName: l.originName,
      destName: l.destName,
      status: l.status,
    }));

  return (
    <CabinetServer active="active">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="shead" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Dispatch</span>
          <h2 className="h2">
            <Truck size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            Active loads
          </h2>
          <p className="lead">
            Every load in progress across your drivers. Open one for full control.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="empty">No active loads right now.</div>
        ) : (
          <ActiveLoads loads={rows} />
        )}
      </div>
    </CabinetServer>
  );
}
