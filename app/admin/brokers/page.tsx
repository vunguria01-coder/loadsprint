import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { getUsers, toSafe, subDaysLeft } from "@/lib/auth";
import { getAllLoads } from "@/lib/loads";
import { CabinetServer } from "@/components/cabinet-server";

export const metadata: Metadata = {
  title: "Brokers — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function AdminListPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const users = getUsers().map(toSafe).filter((u) => u.role === "broker");
  const loads = getAllLoads();

  return (
    <CabinetServer active="brokers">
        <div className="wrap">
          <div className="shead" style={{ marginBottom: 20 }}>
            <span className="eyebrow">Accounts</span>
            <h2 className="h2">Brokers</h2>
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
                    <th>Plan</th>
                    <th>Loads</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const left = subDaysLeft(u);
                    const loadCount = loads.filter(
                      (l) => l.brokerEmail.toLowerCase() === u.email.toLowerCase()
                    ).length;
                    return (
                      <tr key={u.id}>
                        <td><div className="u-name">{u.name}</div></td>
                        <td><div className="u-mail">{u.email}</div></td>
                        <td>
                          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>
                            {u.tier === "none" ? "Free" : u.tier}
                          </div>
                          <div className="u-mail">
                            {u.tier === "none" ? "" : left === null ? "No expiry" : left < 0 ? "Expired" : left + "d left"}
                          </div>
                        </td>
                        <td>{loadCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CabinetServer>
  );
}
