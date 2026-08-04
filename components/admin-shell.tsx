import type { ReactNode } from "react";

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
  const hasAnchors = Boolean(anchors && anchors.length > 0);

  return (
    <div className={`adm-shell${hasAnchors ? "" : " no-rail"}`}>
      {hasAnchors && (
        <nav className="adm-rail" aria-label="On this page">
          <span className="adm-rail-cap">On this page</span>
          {anchors!.map((a) => (
            <a key={a.id} href={`#${a.id}`} className="adm-rail-anchor">
              {a.label}
            </a>
          ))}
        </nav>
      )}

      <div className="adm-main">
        <header className="adm-head">
          <div className="adm-head-text">
            <h1 className="adm-title">{title}</h1>
            {subtitle && <p className="adm-subtitle">{subtitle}</p>}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
