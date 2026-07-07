import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { SupportForm } from "@/components/support-form";

export const metadata: Metadata = {
  title: "Support — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function SupportPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  return (
    <CabinetServer active="support">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <span className="eyebrow">Support</span>
        <h2 className="h2">How can we help?</h2>
        <p className="lead">
          Send us a message — we read every one, look into it, and reply right here.
        </p>
        <SupportForm />
      </div>
    </CabinetServer>
  );
}
