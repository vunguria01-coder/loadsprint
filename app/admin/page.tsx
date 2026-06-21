import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureSeed, getUsers, toSafe } from "@/lib/auth";
import { getPricing, getLimits } from "@/lib/settings";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { AdminUserManager } from "@/components/admin-user-manager";
import { AdminPricing } from "@/components/admin-pricing";
import { AdminLimits } from "@/components/admin-limits";

export const metadata: Metadata = {
  title: "Admin — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  ensureSeed();
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const users = getUsers().map(toSafe);
  const pricing = getPricing();
  const limits = getLimits();

  return (
    <CabinetServer active="admin">
      <div className="wrap">
          <h1 className="admin-h">Control panel</h1>
          <p className="admin-sub">
            Manage accounts, grant subscriptions, set prices, and control
            restricted tools.
          </p>

          <section className="admin-section">
            <h2>Accounts</h2>
            <p className="sx">
              {users.length} account{users.length === 1 ? "" : "s"}. Change a
              plan or grant the restricted location-freeze tool to a single
              account.
            </p>
            <AdminUserManager users={users} showFreeze />
          </section>

          <section className="admin-section">
            <h2>Subscription pricing</h2>
            <p className="sx">
              Edit prices anytime. Changes apply immediately on the public
              pricing page.
            </p>
            <AdminPricing pricing={pricing} />
          </section>

          <section className="admin-section">
            <h2>Driver limits</h2>
            <p className="sx">
              How many drivers each plan includes. Extra drivers beyond the limit
              cost the extra-driver price each.
            </p>
            <AdminLimits limits={limits} />
          </section>
        </div>
    </CabinetServer>
  );
}
