import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { getLoadsByDispatcher, getAllLoads } from "@/lib/loads";
import { ReviewList } from "@/components/review-list";

export const metadata: Metadata = {
  title: "Completed loads — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function ReviewPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");

  const all = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);
  const done = all
    .filter((l) => l.status === "Delivered" || l.status === "Closed")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <CabinetServer active="review">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <div className="shead" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Review</span>
          <h2 className="h2">
            <PackageCheck size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            Completed loads
          </h2>
          <p className="lead">Review your drivers&apos; finished loads — open one to check photos, documents, and export a PDF.</p>
        </div>

        <ReviewList loads={done} />
      </div>
    </CabinetServer>
  );
}
