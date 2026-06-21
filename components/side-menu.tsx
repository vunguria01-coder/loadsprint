"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutGrid,
  Users,
  History,
  FileText,
  Shield,
  LogOut,
  X,
  Building2,
  Truck,
} from "lucide-react";

type Item = { href: string; label: string; icon: ReactNode };

function itemsForRole(role: string): Item[] {
  if (role === "admin") {
    return [
      { href: "/loads", label: "Loadboard", icon: <LayoutGrid size={18} /> },
      { href: "/admin/brokers", label: "Brokers", icon: <Building2 size={18} /> },
      { href: "/admin/dispatchers", label: "Dispatchers", icon: <Users size={18} /> },
      { href: "/admin/drivers", label: "Drivers", icon: <Truck size={18} /> },
      { href: "/admin", label: "Admin", icon: <Shield size={18} /> },
      { href: "/history", label: "History", icon: <History size={18} /> },
    ];
  }
  if (role === "broker") {
    return [
      { href: "/loads", label: "Loadboard", icon: <LayoutGrid size={18} /> },
      { href: "/history", label: "History", icon: <History size={18} /> },
    ];
  }
  // dispatcher
  return [
    { href: "/loads", label: "Loadboard", icon: <LayoutGrid size={18} /> },
    { href: "/drivers", label: "Drivers", icon: <Users size={18} /> },
    { href: "/history", label: "History", icon: <History size={18} /> },
    { href: "/invoice-settings", label: "Invoice details", icon: <FileText size={18} /> },
  ];
}

export function SideMenu({ role = "dispatcher" }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const items = itemsForRole(role);

  async function logout() {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}
      >
        <Image
          src="/loadsprint-logo.png"
          alt="LoadSprint"
          width={793}
          height={200}
          style={{ height: 26, width: "auto" }}
        />
      </button>

      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="drawer-head">
              <Image
                src="/loadsprint-logo.png"
                alt="LoadSprint"
                width={793}
                height={200}
                style={{ height: 24, width: "auto" }}
              />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="drawer-x">
                <X size={20} />
              </button>
            </div>

            <div className="drawer-links">
              {items.map((it) => (
                <Link key={it.href} href={it.href} className="drawer-link" onClick={() => setOpen(false)}>
                  {it.icon}
                  <span>{it.label}</span>
                </Link>
              ))}
            </div>

            <button className="drawer-link drawer-logout" onClick={logout}>
              <LogOut size={18} />
              <span>Log out</span>
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
