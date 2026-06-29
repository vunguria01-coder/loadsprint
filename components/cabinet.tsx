"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, LayoutDashboard, Users, History, Shield, LogOut, Menu, X,
  Building2, Truck, UserCircle, ChevronDown, ArrowLeft, CreditCard, PackageCheck, BarChart3, Wallet,
} from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";

type NavItem = { key: string; href: string; label: string; icon: ReactNode };

function navForRole(role: string, isOwner: boolean): NavItem[] {
  if (role === "admin") {
    return [
      { key: "loads", href: "/loads", label: "Loadboard", icon: <LayoutGrid size={18} /> },
      { key: "brokers", href: "/admin/brokers", label: "Brokers", icon: <Building2 size={18} /> },
      { key: "dispatchers", href: "/admin/dispatchers", label: "Dispatchers", icon: <Users size={18} /> },
      { key: "drivers", href: "/admin/drivers", label: "Drivers", icon: <Truck size={18} /> },
      { key: "admin", href: "/admin", label: "Admin", icon: <Shield size={18} /> },
      { key: "history", href: "/history", label: "History", icon: <History size={18} /> },
    ];
  }
  if (role === "broker") {
    return [
      { key: "loads", href: "/loads", label: "Loadboard", icon: <LayoutGrid size={18} /> },
      { key: "history", href: "/history", label: "History", icon: <History size={18} /> },
    ];
  }
  return [
    { key: "dashboard", href: "/dashboard", label: "Home", icon: <LayoutDashboard size={18} /> },
    { key: "drivers", href: "/drivers", label: "Drivers", icon: <Users size={18} /> },
    { key: "review", href: "/review", label: "Completed", icon: <PackageCheck size={18} /> },
    { key: "insights", href: "/insights", label: "Insights", icon: <BarChart3 size={18} /> },
    { key: "settlements", href: "/settlements", label: "Settlements", icon: <Wallet size={18} /> },
    // Team (additional dispatcher seats) — owners only.
    ...(isOwner ? [{ key: "team", href: "/team", label: "Team", icon: <UserCircle size={18} /> }] : []),
    { key: "billing", href: "/billing", label: "Plans & billing", icon: <CreditCard size={18} /> },
  ];
}

function subLabel(tier: string, daysLeft: number | null, expiresAt?: string): string {
  if (tier === "none") return "No plan";
  const t = tier[0].toUpperCase() + tier.slice(1);
  if (daysLeft === null) return `${t} · no expiry`;
  if (daysLeft < 0) return `${t} · expired`;
  const left = `${t} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  if (!expiresAt) return left;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return left;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${left} · until ${date}`;
}

export function Cabinet({
  role = "dispatcher",
  name,
  email,
  tier,
  daysLeft,
  expiresAt,
  isOwner = false,
  active,
  children,
}: {
  role?: string;
  name: string;
  email: string;
  tier: string;
  daysLeft: number | null;
  expiresAt?: string;
  isOwner?: boolean;
  active?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false); // mobile sidebar
  const [acc, setAcc] = useState(false); // account dropdown
  const router = useRouter();
  const items = navForRole(role, isOwner);
  const expired = tier !== "none" && daysLeft !== null && daysLeft < 0;

  async function logout() {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  }

  return (
    <div className="cab">
      {/* Sidebar */}
      <aside className={`cab-side${open ? " open" : ""}`}>
        <div className="cab-brand">
          <Link href="/loads" onClick={() => setOpen(false)}>
            <Image src="/loadsprint-logo.png" alt="LoadSprint" width={793} height={200} style={{ height: 26, width: "auto" }} />
          </Link>
          <button className="cab-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="cab-nav">
          {items.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`cab-link${active === it.key ? " active" : ""}`}
            >
              {it.icon}<span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <button className="cab-link cab-logout" onClick={logout}>
          <LogOut size={18} /><span>Log out</span>
        </button>
      </aside>

      {open && <div className="cab-scrim" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="cab-main">
        <header className="cab-top">
          <button className="cab-burger" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <button className="cab-back" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft size={18} /> <span>Back</span>
          </button>
          <div style={{ flex: 1 }} />
          <NotificationsBell />
          <div className="cab-acc">
            <button className="cab-acc-btn" onClick={() => setAcc((v) => !v)}>
              <UserCircle size={22} />
              <span className="cab-acc-name">{name?.split(" ")[0] || "Account"}</span>
              <ChevronDown size={15} />
            </button>
            {acc && (
              <>
                <div className="cab-acc-scrim" onClick={() => setAcc(false)} />
                <div className="cab-acc-menu">
                  <div className="cab-acc-head">
                    <div className="cab-acc-full">{name}</div>
                    <div className="cab-acc-mail">{email}</div>
                  </div>
                  <div className={`cab-acc-sub${expired ? " expired" : ""}`}>
                    <span className="cas-dot" />
                    {subLabel(tier, daysLeft, expiresAt)}
                  </div>
                  {(role === "dispatcher" || role === "admin") && (
                    <Link href="/billing" className="cab-acc-item" onClick={() => setAcc(false)}>Plans &amp; billing</Link>
                  )}
                  {role === "dispatcher" && (
                    <Link href="/invoice-settings" className="cab-acc-item" onClick={() => setAcc(false)}>Invoice details</Link>
                  )}
                  <button className="cab-acc-item logout" onClick={logout}>Log out</button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="cab-content">{children}</main>
      </div>
    </div>
  );
}
