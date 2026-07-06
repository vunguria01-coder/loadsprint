import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, Wallet, Wrench, Fuel, Receipt, TrendingUp, DollarSign } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import { getDriverGlobalLocation } from "@/lib/driver-location";
import { getTruckById, truckFinance } from "@/lib/trucks";
import { money } from "@/lib/format";
import { CabinetServer } from "@/components/cabinet-server";
import { DriverMap } from "@/components/driver-map";
import { TruckDetail } from "@/components/truck-detail";

export const metadata: Metadata = {
  title: "Truck — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const { id } = await params;
  const ownerId = me.ownerId || me.id;
  const truck = getTruckById(id);
  if (!truck || (me.role !== "admin" && truck.ownerId !== ownerId)) redirect("/trucks");

  const loads: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const fin = truckFinance(truck, loads);

  // Driver options + assigned driver's last-known location for the map.
  const invites = getInvitesByRole(me.id, "driver");
  const driverOpts = Array.from(new Set(invites.map((i) => i.email.toLowerCase()))).map(
    (email) => ({ email, name: findByEmail(email)?.name || email })
  );
  const driverName = truck.driverEmail
    ? findByEmail(truck.driverEmail)?.name || truck.driverEmail
    : null;

  let points: { ref: string; lat: number; lng: number; status: string }[] = [];
  let mapNote: string | undefined;
  if (truck.driverEmail) {
    const last = getDriverGlobalLocation(truck.driverEmail);
    if (last) {
      points = [{ ref: truck.name, lat: last.lat, lng: last.lng, status: "Last known location" }];
      mapNote =
        truck.eld.provider === "none" || !truck.eld.connected
          ? `From ${driverName}'s phone GPS · ${new Date(last.at).toLocaleString()}. Connect an ELD for live truck tracking.`
          : `Last known position · ${new Date(last.at).toLocaleString()}.`;
    }
  }

  const tiles = [
    { Icon: Wallet, val: money(fin.invested), label: "Invested", accent: "sx-sky" },
    { Icon: Wrench, val: money(fin.repair), label: "Repairs", accent: "sx-blue" },
    { Icon: Fuel, val: money(fin.fuel), label: "Fuel", accent: "sx-sky" },
    { Icon: Receipt, val: money(fin.other), label: "Other", accent: "sx-blue" },
    { Icon: DollarSign, val: money(fin.income), label: "Income", accent: "sx-green" },
    { Icon: TrendingUp, val: money(fin.net), label: "Net profit", accent: fin.net >= 0 ? "sx-emerald" : "sx-red" },
  ];

  const sub = [
    truck.unit && `Unit ${truck.unit}`,
    [truck.year, truck.make, truck.model].filter(Boolean).join(" "),
    truck.plate,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <CabinetServer active="trucks">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <div className="shead" style={{ marginBottom: 18 }}>
          <span className="eyebrow">Truck</span>
          <h2 className="h2">
            <Container size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            {truck.name}
          </h2>
          <p className="lead">{sub || "No details yet"}</p>
        </div>

        <div className="home-stats" style={{ marginBottom: 18 }}>
          {tiles.map((t) => {
            const Icon = t.Icon;
            return (
              <div className={`home-stat ${t.accent}`} key={t.label}>
                <div className="hs-ic"><Icon size={18} /></div>
                <div className="hs-val">{t.val}</div>
                <div className="hs-label">{t.label}</div>
              </div>
            );
          })}
        </div>

        <DriverMap points={points} note={mapNote} />

        <TruckDetail
          truck={truck}
          drivers={driverOpts}
          driverName={driverName}
          incomeNote={
            truck.driverEmail
              ? `Income counts delivered loads run by ${driverName}.`
              : "Assign a driver to attribute load income to this truck."
          }
        />
      </div>
    </CabinetServer>
  );
}
