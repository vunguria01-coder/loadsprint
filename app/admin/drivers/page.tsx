import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { AdminShell } from "@/components/admin-shell";
import { getUsers, toSafe, getUserById } from "@/lib/auth";
import { getAllLoads } from "@/lib/loads";
import { getInvites } from "@/lib/invites";
import { AdminUserManager } from "@/components/admin-user-manager";

export const metadata: Metadata = {
  title: "Drivers — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function AdminDriversPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const users = getUsers().map(toSafe).filter((u) => u.role === "driver");
  const loads = getAllLoads();
  const invites = getInvites();
  const extras: Record<string, string> = {};
  for (const u of users) {
    const n = loads.filter((l) => l.driverEmail.toLowerCase() === u.email.toLowerCase()).length;
    const inv = invites.find((i) => i.email.toLowerCase() === u.email.toLowerCase());
    const disp = inv ? getUserById(inv.createdBy)?.name || inv.createdByName || "—" : "—";
    extras[u.id] = `Dispatcher: ${disp} · ${n} load${n === 1 ? "" : "s"}`;
  }

  return (
    <CabinetServer active="drivers">
      <div className="wrap">
        <AdminShell
          active="drivers"
          title="Drivers"
          subtitle={`${users.length} registered.`}
          adminName={me.name}
        >
          <AdminUserManager users={users} extras={extras} />
        </AdminShell>
      </div>
    </CabinetServer>
  );
}
