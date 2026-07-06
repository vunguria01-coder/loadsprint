import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";
import { LoadBoard, type LoadSummary } from "@/components/load-board";
import { NewLoadButton } from "@/components/new-load-button";

export const metadata: Metadata = {
  title: "Active loads — LoadSprint",
  robots: { index: false, follow: false },
};

function toSummary(l: Load): LoadSummary {
  return {
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
    driverName: l.driverName || "Unassigned",
    docs: l.documents.length,
    photos: l.photos.length,
    messages: l.messages.length,
    loadRate: l.loadRate,
    pickupDate: l.pickupDate,
    deliveryDate: l.deliveryDate,
    sharingLive: l.driverShareLocation !== false && !!l.driverPoint,
    sharingPaused: l.driverShareLocation === false,
    search: [l.ref, l.driverName, l.originName, l.destName, l.brokerName, l.brokerEmail, l.billTo || ""]
      .join(" ")
      .toLowerCase(),
  };
}

export default async function ActiveLoadsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const all = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const active = all.filter((l) => l.status !== "Delivered" && l.status !== "Closed");
  const summaries = active.map(toSummary);

  const driverOpts =
    me.role === "dispatcher"
      ? Array.from(new Set(getInvitesByRole(me.id, "driver").map((i) => i.email.toLowerCase()))).map(
          (email) => ({ email, name: findByEmail(email)?.name || email })
        )
      : [];

  return (
    <CabinetServer active="active">
      <div className="wrap home-wrap">
        <div
          className="shead"
          style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <span className="eyebrow">Dispatch</span>
            <h2 className="h2">
              <Truck size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
              Active loads
            </h2>
            <p className="lead">Every load in progress across your drivers. Open one for full control.</p>
          </div>
          {me.role === "dispatcher" && <NewLoadButton drivers={driverOpts} />}
        </div>

        {summaries.length === 0 ? (
          <div className="home-empty">
            <p>No active loads right now. Create one to get a truck moving.</p>
          </div>
        ) : (
          <LoadBoard loads={summaries} grouped />
        )}
      </div>
    </CabinetServer>
  );
}
