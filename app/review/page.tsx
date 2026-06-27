import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageCheck, Image as ImageIcon, FileText, ChevronRight } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";

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

  // Group completed loads by driver so the dispatcher can review per driver.
  const groups = new Map<string, { name: string; loads: Load[] }>();
  for (const l of done) {
    const key = (l.driverEmail || "unknown").toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: l.driverName || l.driverEmail || "Unknown driver", loads: [] });
    groups.get(key)!.loads.push(l);
  }
  const driverGroups = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));

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

        {driverGroups.length === 0 ? (
          <p className="px">No completed loads yet. Delivered and closed loads will appear here for review.</p>
        ) : (
          driverGroups.map((g) => (
            <div key={g.name} className="rev-group">
              <div className="rev-driver">
                {g.name}
                <span className="rev-count">{g.loads.length} load{g.loads.length === 1 ? "" : "s"}</span>
              </div>
              <div className="load-list">
                {g.loads.map((l) => (
                  <Link key={l.id} href={`/loads/${l.id}`} className="rev-card" style={{ textDecoration: "none" }}>
                    <div className="rev-main">
                      <div className="lc-top">
                        <span className="lc-ref">{l.ref}</span>
                        <span className="status-chip">{l.status}</span>
                      </div>
                      <div className="lc-route">{l.originName} → {l.destName}</div>
                      <div className="rev-meta">
                        <span><ImageIcon size={14} /> {l.photos?.length || 0} photos</span>
                        <span><FileText size={14} /> {l.documents?.length || 0} docs</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="rev-arrow" />
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </CabinetServer>
  );
}
