import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasActiveSub, findByEmail } from "@/lib/auth";
import { getInvitesBy } from "@/lib/invites";
import { getLoadsByDispatcher, currentPoint } from "@/lib/loads";
import { DriverLoads } from "@/components/driver-loads";
import { DriverMap } from "@/components/driver-map";
import { CreateLoad } from "@/components/create-load";

export const metadata: Metadata = {
  title: "Driver — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasActiveSub(me)) redirect("/pricing");

  const { email: raw } = await params;
  const email = decodeURIComponent(raw).toLowerCase();

  // ownership: this dispatcher must have invited the driver (admin exempt)
  const invited = getInvitesBy(me.id).some((i) => i.email.toLowerCase() === email);
  if (!invited && me.role !== "admin") redirect("/drivers");

  const user = findByEmail(email);
  const name = user?.name || email;
  const loads = getLoadsByDispatcher(me.id)
    .filter((l) => l.driverEmail.toLowerCase() === email)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const points = loads
    .filter((l) => l.status !== "Delivered" && l.status !== "Closed")
    .map((l) => {
      const p = currentPoint(l);
      return { ref: l.ref, lat: p.lat, lng: p.lng, status: l.status };
    });

  const list = loads.map((l) => ({
    id: l.id,
    ref: l.ref,
    originName: l.originName,
    destName: l.destName,
    status: l.status,
  }));

  return (
    <div className="auth">
      <div className="auth-top">
        <Link href="/drivers" className="back">
          <ArrowLeft size={16} /> Drivers
        </Link>
        <Link href="/loads" className="back">All loads</Link>
      </div>
      <main className="admin-body" style={{ position: "relative", zIndex: 1 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="shead" style={{ marginBottom: 18 }}>
            <span className="eyebrow">Driver</span>
            <h2 className="h2">{name}</h2>
            <p className="lead">{email}{user ? "" : " · invite pending"}</p>
          </div>

          <DriverMap points={points} />

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 12 }}>Loads</h3>
            <DriverLoads loads={list} />
          </div>

          <div style={{ marginTop: 18 }}>
            <CreateLoad driverName={name} driverEmail={email} />
          </div>
        </div>
      </main>
    </div>
  );
}
