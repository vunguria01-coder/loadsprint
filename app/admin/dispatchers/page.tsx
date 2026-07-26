import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { AdminShell } from "@/components/admin-shell";
import { getUsers, toSafe } from "@/lib/auth";
import { getAllLoads } from "@/lib/loads";
import { AdminUserManager } from "@/components/admin-user-manager";

export const metadata: Metadata = {
  title: "Dispatchers — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function AdminDispatchersPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const users = getUsers().map(toSafe).filter((u) => u.role === "dispatcher");
  const loads = getAllLoads();
  const extras: Record<string, string> = {};
  for (const u of users) {
    const n = loads.filter((l) => l.dispatcherId === u.id).length;
    extras[u.id] = `${n} load${n === 1 ? "" : "s"}`;
  }

  return (
    <CabinetServer active="dispatchers">
      <div className="wrap">
        <AdminShell
          active="dispatchers"
          title="Dispatchers"
          subtitle={`${users.length} registered. Grant or change a plan.`}
          adminName={me.name}
        >
          <AdminUserManager users={users} extras={extras} showFreeze />
        </AdminShell>
      </div>
    </CabinetServer>
  );
}
