import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { getAllTickets } from "@/lib/support";
import { AdminSupport } from "@/components/admin-support";

export const metadata: Metadata = {
  title: "Support inbox — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function AdminSupportPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const tickets = getAllTickets().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const open = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <CabinetServer active="support">
      <div className="wrap">
        <div className="shead" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Support</span>
          <h2 className="h2">Support inbox</h2>
          <p className="lead">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"} · {open} open. AI triages each one
            with a category, severity, an internal report and a draft reply — you review and send.
          </p>
        </div>
        <AdminSupport tickets={tickets} />
      </div>
    </CabinetServer>
  );
}
