import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import type { LoadStatus } from "@/lib/loads";

export type ActiveLoadRow = {
  id: string;
  ref: string;
  driverName: string;
  originName: string;
  destName: string;
  status: LoadStatus;
};

// A single list of every in-progress load across all of the dispatcher's
// drivers, so they can see and open active work without drilling into each driver.
export function ActiveLoads({ loads }: { loads: ActiveLoadRow[] }) {
  if (loads.length === 0) return null;
  return (
    <div className="active-loads">
      <div className="al-head">
        <h3>Active loads</h3>
        <span className="al-count">{loads.length}</span>
      </div>
      <div className="load-list">
        {loads.map((l) => (
          <Link
            key={l.id}
            href={`/loads/${l.id}`}
            className="load-card"
            style={{ textDecoration: "none" }}
          >
            <div className="lc-top">
              <span className="lc-ref">{l.ref}</span>
              <StatusChip status={l.status} />
            </div>
            <div className="lc-route">
              <MapPin /> {l.originName} <ArrowRight /> {l.destName}
            </div>
            <div className="lc-sub">Driver: {l.driverName}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
