import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { getUsers, toSafe, subDaysLeft, getUserById } from "@/lib/auth";
import { getAllLoads } from "@/lib/loads";
import { getInvites } from "@/lib/invites";
import { AppHeader } from "@/components/app-header";

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

  return (
    <>
      <AppHeader back="/admin" backLabel="Admin" role={me.role} />
      <main className="dash">
        <div className="wrap">
          <div className="shead" style={{ marginBottom: 20 }}>
            <span className="eyebrow">Accounts</span>
            <h2 className="h2">Drivers</h2>
          </div>
          {users.length === 0 ? (
            <p className="px">None yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="acc">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Dispatcher</th>
                    <th>Loads</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const loadCount = loads.filter(
                      (l) => l.driverEmail.toLowerCase() === u.email.toLowerCase()
                    ).length;
                    const inv = invites.find(
                      (i) => i.email.toLowerCase() === u.email.toLowerCase()
                    );
                    const disp = inv
                      ? getUserById(inv.createdBy)?.name || inv.createdByName || "—"
                      : "—";
                    return (
                      <tr key={u.id}>
                        <td><div className="u-name">{u.name}</div></td>
                        <td><div className="u-mail">{u.email}</div></td>
                        <td>{disp}</td>
                        <td>{loadCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
