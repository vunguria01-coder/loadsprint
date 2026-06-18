import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSeed, getUsers, toSafe } from "@/lib/auth";
import { getPricing, getLimits } from "@/lib/settings";
import { currentUser } from "@/lib/guard";
import { AdminAccounts } from "@/components/admin-accounts";
import { AdminPricing } from "@/components/admin-pricing";
import { AdminLimits } from "@/components/admin-limits";
import { LogoutButton } from "@/components/logout-button";

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
    <>
      <header className="admin-top">
        <div className="wrap">
          <Link href="/" aria-label="LoadSprint home">
            <Image
              src="/loadsprint-logo.png"
              alt="LoadSprint"
              width={793}
              height={200}
              priority
              style={{ height: 26, width: "auto" }}
            />
          </Link>
          <div className="right">
            <span className="admin-tag">Admin</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="admin-body">
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
            <AdminAccounts users={users} />
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
      </main>
    </>
  );
}
