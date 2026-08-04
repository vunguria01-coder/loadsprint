import type { ReactNode } from "react";

/**
 * The one empty-state look the app uses: an icon, a short headline and a line
 * explaining what will show up here. Pages differ only in wording and icon.
 */
export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="am-zero">
      <span className="am-zero-icon" aria-hidden="true">{icon}</span>
      <p className="am-zero-title">{title}</p>
      {sub && <p className="am-zero-sub">{sub}</p>}
      {action}
    </div>
  );
}
