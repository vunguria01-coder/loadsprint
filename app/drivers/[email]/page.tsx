import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher, currentPoint } from "@/lib/loads";
import { getDriverGlobalLocation } from "@/lib/driver-location";
import { DriverLoads } from "@/components/driver-loads";
import { DriverMap } from "@/components/driver-map";
import { CreateLoad } from "@/components/create-load";
import { DriverPanel } from "@/components/driver-panel";

export const metadata: Metadata = {
  title: "Driver — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const { email: raw } = await params;
  const email = decodeURIComponent(raw).toLowerCase();

  // ownership: this dispatcher must have invited the driver (admin exempt)
  const invited = getInvitesByRole(me.id, "driver").some((i) => i.email.toLowerCase() === email);
  if (!invited && me.role !== "admin") redirect("/drivers");

  const user = findByEmail(email);
  const name = user?.name || email;
  const loads = getLoadsByDispatcher(me.id)
    .filter((l) => l.driverEmail.toLowerCase() === email)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const activePoints: { ref: string; lat: number; lng: number; status: string }[] =
    loads
      .filter((l) => l.status !== "Delivered" && l.status !== "Closed")
      .map((l) => {
        const p = currentPoint(l);
        return { ref: l.ref, lat: p.lat, lng: p.lng, status: l.status };
      });

  // When the driver isn't on an active load, still show where they are: their
  // last-known GPS (reported by the driver app independent of any load).
  let points = activePoints;
  let mapNote: string | undefined;
  if (activePoints.length === 0) {
    const last = getDriverGlobalLocation(email);
    if (last) {
      points = [{ ref: name, lat: last.lat, lng: last.lng, status: "Last known location" }];
      mapNote = `Not on an active load — showing last known position (${new Date(
        last.at
      ).toLocaleString()}).`;
    }
  }

  const list = loads.map((l) => ({
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
    remainingMeters: l.remainingMeters,
    etaSeconds: l.etaSeconds,
  }));

  // Stats + history for the slide-out panel.
  const completed = loads.filter((l) => l.status === "Delivered" || l.status === "Closed");
  const stats = {
    total: loads.length,
    completed: completed.length,
    active: loads.filter((l) => l.status !== "Delivered" && l.status !== "Closed").length,
    earnings: completed.reduce((s, l) => s + (l.loadRate || 0), 0),
  };
  const history = completed.map((l) => ({
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
    rate: l.loadRate,
  }));

  return (
    <CabinetServer active="drivers">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="shead" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">Driver</span>
              <h2 className="h2">{name}</h2>
              <p className="lead">{email}{user ? "" : " · invite pending"}</p>
            </div>
            <DriverPanel name={name} email={email} stats={stats} history={history} />
          </div>

          <DriverMap points={points} note={mapNote} />

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 12 }}>Loads</h3>
            <DriverLoads loads={list} />
          </div>

          <div id="new-load" style={{ marginTop: 18, scrollMarginTop: 90 }}>
            <CreateLoad driverName={name} driverEmail={email} isAdmin={me.role === "admin"} />
          </div>
        </div>
      </CabinetServer>
  );
}
