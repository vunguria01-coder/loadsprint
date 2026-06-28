import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { currentUser } from "@/lib/guard";
import { CabinetServer } from "@/components/cabinet-server";
import { TeamManager } from "@/components/team-manager";
import { DispatchersList } from "@/components/dispatchers-list";
import { TeamStats } from "@/components/team-stats";
import { hasAccess, findByEmail, getSubDispatchers } from "@/lib/auth";
import { getInvitesByRole } from "@/lib/invites";
import { getLoadsByDispatcher } from "@/lib/loads";
import { seatAllowance } from "@/lib/billing-plans";

export const metadata: Metadata = {
  title: "Team — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function TeamPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  // Owner-only: admins and dispatchers without an ownerId.
  const isOwner = me.role === "admin" || (me.role === "dispatcher" && !me.ownerId);
  if (!isOwner) redirect("/drivers");
  if (me.role === "dispatcher" && !hasAccess(me)) redirect("/pricing");

  const invites = getInvitesByRole(me.id, "dispatcher");
  const emails = Array.from(new Set(invites.map((i) => i.email.toLowerCase())));
  const dispatchers = emails.map((email) => {
    const user = findByEmail(email);
    return { email, name: user?.name || email, joined: !!user };
  });

  const used = emails.length;
  const limit = me.role === "admin" ? Infinity : seatAllowance(me.planId, me.tier);
  const canAddMore = limit === Infinity || used < limit;

  // Per-dispatcher stats: the owner + every sub-dispatcher. "total" is the value
  // of all loads; "deliveredTotal" only of Delivered/Closed loads; "earned" is
  // their commission of the delivered total.
  const orgDispatchers = [me, ...getSubDispatchers(me.id)];
  const stats = orgDispatchers.map((d) => {
    const loads = getLoadsByDispatcher(d.id);
    const total = loads.reduce((sum, l) => sum + (l.loadRate || 0), 0);
    const deliveredTotal = loads
      .filter((l) => l.status === "Delivered" || l.status === "Closed")
      .reduce((sum, l) => sum + (l.loadRate || 0), 0);
    const pct = d.commissionPct || 0;
    return {
      id: d.id,
      name: d.name + (d.id === me.id ? " (owner)" : ""),
      email: d.email,
      count: loads.length,
      total,
      deliveredTotal,
      pct,
      earned: Math.round((deliveredTotal * pct) / 100),
    };
  });

  return (
    <CabinetServer active="team">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="shead" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow">Account</span>
            <h2 className="h2">
              <Users size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
              Team
            </h2>
            <p className="lead">Invite additional dispatchers to your account. They share your plan and can manage loads and drivers.</p>
          </div>
          {canAddMore && <TeamManager invites={invites} />}
        </div>

        <div className="seat-meter">
          <div className="seat-info">
            <span className="seat-count">
              {used}
              <i> / {limit === Infinity ? "∞" : limit}</i>
            </span>
            <span className="seat-label">dispatcher seats used</span>
          </div>
          <div className="seat-right">
            {limit === Infinity ? (
              <span className="seat-ok">Unlimited on your plan</span>
            ) : canAddMore ? (
              <span className="seat-ok">You can add {limit - used} more</span>
            ) : (
              <span className="seat-full">Seat limit reached — upgrade for more</span>
            )}
          </div>
        </div>

        {dispatchers.length === 0 ? (
          <p className="px">No additional dispatchers yet. Use “Add dispatcher” to invite your first teammate.</p>
        ) : (
          <DispatchersList dispatchers={dispatchers} />
        )}

        <div style={{ marginTop: 34 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Loads & commissions</h3>
          <p className="px" style={{ marginBottom: 14 }}>
            Set each dispatcher’s commission %. Earnings are their share of
            delivered loads. Only you (the owner) see these percentages.
          </p>
          <TeamStats rows={stats} />
        </div>
      </div>
    </CabinetServer>
  );
}
