import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import {
  getLoadsByDispatcher,
  getLoadsByBrokerEmail,
  getLoadsByDriverEmail,
  getAllLoads,
  type Load,
} from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";
import { LoadBoard, type LoadSummary } from "@/components/load-board";
import { NewLoadButton } from "@/components/new-load-button";

export const metadata: Metadata = {
  title: "Loads — LoadSprint",
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

export default async function LoadsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if ((me.role === "dispatcher" || me.role === "broker") && !hasAccess(me)) {
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
    loads = getLoadsByDispatcher(me.id);
  }

  const summaries = loads.map(toSummary);

  // Driver options for the "New load" picker (dispatchers only create loads).
  const driverOpts =
    me.role === "dispatcher"
      ? Array.from(new Set(getInvitesByRole(me.id, "driver").map((i) => i.email.toLowerCase()))).map(
          (email) => ({ email, name: findByEmail(email)?.name || email })
        )
      : [];

  return (
    <CabinetServer active="loads">
      <div className="wrap">
        <div
          className="shead"
          style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <h1 className="admin-h">Loads</h1>
            <p className="admin-sub">
              {me.role === "broker"
                ? "Loads where you are the broker."
                : "Search, filter and open any load for full control."}
            </p>
          </div>
          {me.role === "dispatcher" && <NewLoadButton drivers={driverOpts} />}
        </div>

        {summaries.length === 0 ? (
          <div className="home-empty">
            <p>
              {me.role === "broker"
                ? "No loads yet. They appear here once a dispatcher shares one with you."
                : "No loads yet. Create your first load to get started."}
            </p>
            {me.role === "dispatcher" && (
              <Link href="/drivers" className="home-empty-link">Go to drivers →</Link>
            )}
          </div>
        ) : (
          <LoadBoard loads={summaries} grouped={me.role !== "broker"} />
        )}
      </div>
    </CabinetServer>
  );
}
