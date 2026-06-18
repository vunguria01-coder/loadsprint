import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasActiveSub } from "@/lib/auth";
import { InvoiceProfileForm } from "@/components/invoice-profile-form";

export const metadata: Metadata = {
  title: "Invoice settings — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function InvoiceSettingsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasActiveSub(me)) redirect("/pricing");

  return (
    <div className="auth">
      <div className="auth-top">
        <Link href="/dashboard" className="back">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <Link href="/loads" className="back">
          Loads
        </Link>
      </div>
      <main className="admin-body" style={{ position: "relative", zIndex: 1 }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="shead" style={{ marginBottom: 20 }}>
            <span className="eyebrow">Settings</span>
            <h2 className="h2">Invoice details</h2>
          </div>
          <InvoiceProfileForm />
        </div>
      </main>
    </div>
  );
}
