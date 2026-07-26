import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureSeed, getUsers, toSafe } from "@/lib/auth";
import { getPricing, getLimits } from "@/lib/settings";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { AdminShell } from "@/components/admin-shell";
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
        <AdminShell
          active="accounts"
          title="Control panel"
          subtitle="Accounts, subscriptions, prices and restricted tools."
          adminName={me.name}
          anchors={[
            { id: "accounts", label: "Accounts" },
            { id: "pricing", label: "Subscription pricing" },
            { id: "limits", label: "Driver limits" },
          ]}
        >
          <section className="admin-section" id="accounts">
            <h2>Accounts</h2>
            <p className="sx">
              {users.length} account{users.length === 1 ? "" : "s"}. Change a
              plan or grant the restricted location-freeze tool to a single
              account.
            </p>
            <AdminUserManager users={users} showFreeze />
          </section>

          <section className="admin-section" id="pricing">
            <h2>Subscription pricing</h2>
            <p className="sx">
              Edit prices anytime. Changes apply immediately on the public
              pricing page.
            </p>
            <AdminPricing pricing={pricing} />
          </section>

          <section className="admin-section" id="limits">
            <h2>Driver limits</h2>
            <p className="sx">
              How many drivers each plan includes. Extra drivers beyond the limit
              cost the extra-driver price each.
            </p>
            <AdminLimits limits={limits} />
          </section>
        </AdminShell>
      </div>
    </CabinetServer>
  );
}
