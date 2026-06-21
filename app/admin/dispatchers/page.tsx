import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
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
        <div className="shead" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Accounts</span>
          <h2 className="h2">Dispatchers</h2>
          <p className="lead">{users.length} registered. Grant or change a plan.</p>
        </div>
        <AdminUserManager users={users} extras={extras} showFreeze />
      </div>
    </CabinetServer>
  );
}
