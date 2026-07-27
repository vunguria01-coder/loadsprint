import type { ReactNode } from "react";
import Link from "next/link";
import { Shield, Building2, Users, Truck, LifeBuoy } from "lucide-react";
import { getUsers } from "@/lib/auth";
import { getAllTickets } from "@/lib/support";

/** Admin sections, in the order they appear in the rail. */
const sections = [
  { key: "brokers", href: "/admin/brokers", label: "Brokers", icon: Building2 },
  { key: "dispatchers", href: "/admin/dispatchers", label: "Dispatchers", icon: Users },
  { key: "accounts", href: "/admin", label: "Accounts", icon: Shield },
  { key: "drivers", href: "/admin/drivers", label: "Drivers", icon: Truck },
  { key: "support", href: "/admin/support", label: "Support", icon: LifeBuoy },
];

/** How many rows each section lists, so the rail shows the same numbers the pages do. */
function sectionCounts(): Record<string, number> {
  const users = getUsers();
  const byRole = (role: string) => users.filter((u) => u.role === role).length;
  return {
    brokers: byRole("broker"),
    dispatchers: byRole("dispatcher"),
    accounts: users.length,
    drivers: byRole("driver"),
    support: getAllTickets().length,
  };
}

export type AdminAnchor = { id: string; label: string };

/**
 * Shared chrome for every admin screen: one compact header line and a sticky
 * rail that jumps between admin sections (and, when given anchors, between the
 * sections of the current page).
 */
export function AdminShell({
  active,
  title,
  subtitle,
  adminName,
  anchors,
  children,
}: {
  active: string;
  title: string;
  subtitle?: string;
  adminName?: string;
  anchors?: AdminAnchor[];
  children: ReactNode;
}) {
  const counts = sectionCounts();

  return (
    <div className="adm-shell">
      <nav className="adm-rail" aria-label="Admin sections">
        <span className="adm-rail-cap">Sections</span>
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.key}
              href={s.href}
              className={`adm-rail-link${active === s.key ? " active" : ""}`}
              aria-current={active === s.key ? "page" : undefined}
            >
              <Icon size={16} />
              <span>{s.label}</span>
              <span className="adm-rail-count">{counts[s.key]}</span>
            </Link>
          );
        })}

        {anchors && anchors.length > 0 && (
          <>
            <span className="adm-rail-cap">On this page</span>
            {anchors.map((a) => (
              <a key={a.id} href={`#${a.id}`} className="adm-rail-anchor">
                {a.label}
              </a>
            ))}
          </>
        )}
      </nav>

      <div className="adm-main">
        <header className="adm-head">
          <div className="adm-head-text">
            <h1 className="adm-title">{title}</h1>
            {subtitle && <p className="adm-subtitle">{subtitle}</p>}
          </div>
          <span className="adm-badge">
            <Shield size={13} />
            {adminName || "Admin"}
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
