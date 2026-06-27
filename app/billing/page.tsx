import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { BillingPlansView } from "@/components/billing-plans";

export const metadata: Metadata = {
  title: "Plans & billing — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");

  const { status } = await searchParams;

  return (
    <CabinetServer active="billing">
      <div className="wrap" style={{ maxWidth: 1000 }}>
        <div className="shead" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Billing</span>
          <h2 className="h2">Plans &amp; billing</h2>
          <p className="lead">Choose a plan to unlock dispatcher features and add drivers.</p>
        </div>
        <BillingPlansView status={status} />
      </div>
    </CabinetServer>
  );
}
