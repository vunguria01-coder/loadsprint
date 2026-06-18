import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { LogoutButton } from "@/components/logout-button";

export function AppHeader({
  back,
  backLabel,
}: {
  back?: string;
  backLabel?: string;
}) {
  return (
    <header className="dash-top">
      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" aria-label="LoadSprint home">
            <Image
              src="/loadsprint-logo.png"
              alt="LoadSprint"
              width={793}
              height={200}
              style={{ height: 26, width: "auto" }}
            />
          </Link>
          {back && (
            <Link href={back} className="back" style={{ color: "var(--muted)", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={15} /> {backLabel || "Back"}
            </Link>
          )}
        </div>
        <div className="dash-user">
          <NotificationsBell />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
