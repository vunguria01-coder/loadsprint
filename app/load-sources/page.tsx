import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { hasAccess } from "@/lib/auth";
import { LoadSourceConnectionsForm } from "@/components/load-source-connections-form";
import { LoadSourceReadiness } from "@/components/load-source-readiness";

export const metadata: Metadata = {
  title: "Load sources — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function LoadSourcesPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  return (
    <CabinetServer active="load-sources">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <div className="shead" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Settings</span>
          <h2 className="h2">Load sources</h2>
        </div>
        <LoadSourceConnectionsForm />
        <LoadSourceReadiness />
      </div>
    </CabinetServer>
  );
}
