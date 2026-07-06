import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container, Wallet, Wrench, Fuel, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { hasAccess, findByEmail } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher, getAllLoads, type Load } from "@/lib/loads";
import { getTrucksByOwner, truckFinance, fleetFinance } from "@/lib/trucks";
import { money } from "@/lib/format";
import { CabinetServer } from "@/components/cabinet-server";
import { TruckManager } from "@/components/truck-manager";

export const metadata: Metadata = {
  title: "Trucks — LoadSprint",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  in_shop: "In shop",
  parked: "Parked",
  sold: "Sold",
};

export default async function TrucksPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "dispatcher" && me.role !== "admin") redirect("/dashboard");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const ownerId = me.ownerId || me.id;
  const trucks = getTrucksByOwner(ownerId);
  const loads: Load[] = me.role === "admin" ? getAllLoads() : getLoadsByDispatcher(me.id);

  // Driver options for the "assign driver" dropdown.
  const invites = getInvitesByRole(me.id, "driver");
  const driverOpts = Array.from(new Set(invites.map((i) => i.email.toLowerCase()))).map(
    (email) => ({ email, name: findByEmail(email)?.name || email })
  );

  const fleet = fleetFinance(trucks, loads);

  return (
    <CabinetServer active="trucks">
      <div className="wrap home-wrap">
        <div
          className="shead"
          style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <span className="eyebrow">Fleet</span>
            <h2 className="h2">
              <Container size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
              My Trucks
            </h2>
            <p className="lead">
              Track what each truck costs, what it earns, and where it is.
            </p>
          </div>
          <TruckManager drivers={driverOpts} />
        </div>

        <div className="home-stats">
          <div className="home-stat sx-blue">
            <div className="hs-ic"><Container size={18} /></div>
            <div className="hs-val">{trucks.length}</div>
            <div className="hs-label">Trucks</div>
          </div>
          <div className="home-stat sx-sky">
            <div className="hs-ic"><Wallet size={18} /></div>
            <div className="hs-val">{money(fleet.invested)}</div>
            <div className="hs-label">Invested</div>
          </div>
          <div className="home-stat sx-blue">
            <div className="hs-ic"><Wrench size={18} /></div>
            <div className="hs-val">{money(fleet.repair)}</div>
            <div className="hs-label">Repairs</div>
          </div>
          <div className="home-stat sx-sky">
            <div className="hs-ic"><Fuel size={18} /></div>
            <div className="hs-val">{money(fleet.fuel)}</div>
            <div className="hs-label">Fuel</div>
          </div>
          <div className={`home-stat ${fleet.net >= 0 ? "sx-emerald" : "sx-red"}`}>
            <div className="hs-ic"><TrendingUp size={18} /></div>
            <div className="hs-val">{money(fleet.net)}</div>
            <div className="hs-label">Net profit</div>
          </div>
        </div>

        {trucks.length > 0 && (
          <div style={{ margin: "6px 0 18px" }}>
            <Link href="/trucks/reports" className="btn btn-ghost btn-sm">
              <TrendingUp size={15} /> Monthly &amp; yearly reports
            </Link>
          </div>
        )}

        {trucks.length === 0 ? (
          <div className="home-empty">
            <p>
              No trucks yet. Add your first truck to start tracking its purchase price,
              repairs, fuel and profit — and see it on the map.
            </p>
          </div>
        ) : (
          <div className="truck-grid">
            {trucks.map((t) => {
              const fin = truckFinance(t, loads);
              const driverName = t.driverEmail
                ? findByEmail(t.driverEmail)?.name || t.driverEmail
                : null;
              return (
                <Link key={t.id} href={`/trucks/${t.id}`} className="truck-card">
                  <div className="tc-top">
                    <div className="tc-title">
                      <Container size={18} />
                      <span>{t.name}</span>
                    </div>
                    <span className={`tc-status st-${t.status}`}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  <div className="tc-sub">
                    {[t.unit && `Unit ${t.unit}`, [t.year, t.make, t.model].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                  <div className="tc-driver">
                    {driverName ? `Driver: ${driverName}` : "No driver assigned"}
                  </div>
                  <div className="tc-fin">
                    <div>
                      <span className="tc-fin-l">Cost</span>
                      <span className="tc-fin-v">{money(fin.cost)}</span>
                    </div>
                    <div>
                      <span className="tc-fin-l">Income</span>
                      <span className="tc-fin-v">{money(fin.income)}</span>
                    </div>
                    <div>
                      <span className="tc-fin-l">Net</span>
                      <span className={`tc-fin-v ${fin.net >= 0 ? "pos" : "neg"}`}>
                        {money(fin.net)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </CabinetServer>
  );
}
