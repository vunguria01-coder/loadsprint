import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { SideMenu } from "@/components/side-menu";

export function AppHeader({
  back,
  backLabel,
  role,
}: {
  back?: string;
  backLabel?: string;
  role?: string;
}) {
  return (
    <header className="dash-top">
      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SideMenu role={role} />
          {back && (
            <Link
              href={back}
              className="back"
              style={{ color: "var(--muted)", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ArrowLeft size={15} /> {backLabel || "Back"}
            </Link>
          )}
        </div>
        <div className="dash-user">
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
