import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { hasAccess } from "@/lib/auth";
import { InvoiceProfileForm } from "@/components/invoice-profile-form";

export const metadata: Metadata = {
  title: "Invoice settings — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function InvoiceSettingsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  return (
    <CabinetServer active="invoice">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="shead" style={{ marginBottom: 20 }}>
            <span className="eyebrow">Settings</span>
            <h2 className="h2">Invoice details</h2>
          </div>
          <InvoiceProfileForm />
        </div>
      </CabinetServer>
  );
}
