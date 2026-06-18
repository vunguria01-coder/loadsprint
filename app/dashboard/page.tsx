import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Users, BarChart3 } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { subDaysLeft } from "@/lib/auth";
import { getInvitesBy } from "@/lib/invites";
import { TierBadge } from "@/components/tier-badge";
import { LogoutButton } from "@/components/logout-button";
import { AddDriver } from "@/components/add-driver";
import { NotificationsBell } from "@/components/notifications-bell";

export const metadata: Metadata = {
  title: "Dashboard — LoadSprint",
  robots: { index: false, follow: false },
};

const roleLabels: Record<string, string> = {
  broker: "Broker",
  dispatcher: "Dispatcher",
  driver: "Driver",
};

const brokerCards = [
  { Icon: Package, title: "Post a load", desc: "Create and publish freight for carriers to book." },
  { Icon: Users, title: "Carrier network", desc: "Browse and manage your vetted carrier relationships." },
  { Icon: BarChart3, title: "Margins & reports", desc: "Track rates, margins, and lane performance." },
];

const dispatcherCards = [
  { Icon: Package, title: "Active loads", desc: "Assign drivers and keep every shipment on schedule." },
  { Icon: Users, title: "Driver roster", desc: "Coordinate availability across your drivers." },
  { Icon: BarChart3, title: "Live tracking", desc: "Monitor pickups, transit, and on-time delivery." },
];

export default async function DashboardPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role === "admin") redirect("/admin");

  const cards = me.role === "dispatcher" ? dispatcherCards : brokerCards;
  const invites = me.role === "dispatcher" ? getInvitesBy(me.id) : [];
  const daysLeft = subDaysLeft(me);
  const expired = me.tier !== "none" && daysLeft !== null && daysLeft < 0;

  return (
    <>
      <header className="dash-top">
        <div className="wrap">
          <Link href="/" aria-label="LoadSprint home">
            <Image
              src="/loadsprint-logo.png"
              alt="LoadSprint"
              width={793}
              height={200}
              style={{ height: 28, width: "auto" }}
            />
          </Link>
          <div className="dash-user">
            <NotificationsBell />
            <span className="badge">{roleLabels[me.role]}</span>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>{me.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="dash-body">
        <div className="wrap">
          <div className="dash-hello">
            <h1>
              Welcome, <span className="grad-text">{me.name.split(" ")[0]}</span>
            </h1>
            <p>
              You&apos;re signed in as a {roleLabels[me.role].toLowerCase()}.
              Here&apos;s your workspace.
            </p>
            <div className="plan-row">
              <span className="pl">Current plan:</span>
              <TierBadge tier={me.tier} />
              {me.tier !== "none" && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: expired ? "#fca5a5" : "var(--muted)",
                  }}
                >
                  {daysLeft === null
                    ? "No expiry"
                    : expired
                    ? `Expired ${-daysLeft} day(s) ago — contact your administrator`
                    : `${daysLeft} day(s) left`}
                </span>
              )}
              <Link href="/pricing" className="btn btn-ghost" style={{ padding: "9px 16px" }}>
                {me.tier === "none" ? "Choose a plan" : "Manage plan"}
              </Link>
              {me.role === "dispatcher" && (
                <Link
                  href="/invoice-settings"
                  className="btn btn-ghost"
                  style={{ padding: "9px 16px" }}
                >
                  Invoice details
                </Link>
              )}
              <Link href="/loads" className="btn btn-primary" style={{ padding: "9px 16px" }}>
                Open loads
              </Link>
            </div>
          </div>

          <div className="dash-cards">
            {cards.map((c) => {
              const Icon = c.Icon;
              return (
                <Link className="dash-card" href="/loads" key={c.title}>
                  <div className="di">
                    <Icon strokeWidth={1.9} />
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </Link>
              );
            })}
          </div>

          {me.role === "dispatcher" && <AddDriver invites={invites} />}

          <div className="dash-note">
            Open <strong>Loads</strong> to track location, manage documents and
            photos, change status, and chat — all in one place. Driver accounts
            connect here once the mobile app is live.
          </div>
        </div>
      </main>
    </>
  );
}
