import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher } from "@/lib/loads";
import { getDriverPayMap } from "@/lib/driver-pay";
import { CabinetServer } from "@/components/cabinet-server";
import { SettlementsView, type SettleDriver } from "@/components/settlements-view";

export const metadata: Metadata = {
  title: "Settlements — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function SettlementsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const ownerId = me.ownerId || me.id;
  const invites = getInvitesByRole(me.id, "driver");
  const myLoads = getLoadsByDispatcher(me.id);
  const payMap = getDriverPayMap(ownerId);

  const emails = Array.from(new Set(invites.map((i) => i.email.toLowerCase())));
  const drivers: SettleDriver[] = emails
    .map((email) => {
      const user = findByEmail(email);
      const delivered = myLoads.filter(
        (l) =>
          l.driverEmail.toLowerCase() === email &&
          (l.status === "Delivered" || l.status === "Closed")
      );
      const gross = delivered.reduce((s, l) => s + (l.loadRate || 0), 0);
      const pay = payMap[email];
      return {
        email,
        name: user?.name || email,
        gross,
        count: delivered.length,
        loads: delivered.map((l) => ({
          ref: l.ref,
          route: `${l.originName} → ${l.destName}`,
          rate: l.loadRate || 0,
        })),
        payType: pay?.type || "pct",
        payRate: pay?.rate || 0,
      };
    })
    .sort((a, b) => b.gross - a.gross);

  return (
    <CabinetServer active="settlements">
      <div className="wrap home-wrap">
        <div className="shead" style={{ marginBottom: 22 }}>
          <span className="eyebrow">Payroll</span>
          <h2 className="h2">
            <Wallet size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
            Settlements
          </h2>
          <p className="lead">
            Set each driver&apos;s pay, then download a statement of their delivered loads.
          </p>
        </div>

        <SettlementsView drivers={drivers} company={me.name} />
      </div>
    </CabinetServer>
  );
}
