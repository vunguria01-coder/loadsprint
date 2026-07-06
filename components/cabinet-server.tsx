import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { subDaysLeft } from "@/lib/auth";
import { Cabinet } from "@/components/cabinet";
import { DemoBanner } from "@/components/demo-banner";
import { ensureDispatcherDemo, hasDispatcherDemo } from "@/lib/demo";

export async function CabinetServer({
  active,
  children,
}: {
  active?: string;
  children: ReactNode;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  const isOwner = me.role === "dispatcher" && !me.ownerId;

  // New dispatcher accounts get one-time sample data so nothing looks empty.
  let showDemo = false;
  if (me.role === "dispatcher") {
    ensureDispatcherDemo(me);
    showDemo = hasDispatcherDemo(me);
  }

  return (
    <Cabinet
      role={me.role}
      name={me.name}
      email={me.email}
      tier={me.tier}
      daysLeft={subDaysLeft(me)}
      expiresAt={me.tierExpiresAt}
      isOwner={isOwner}
      active={active}
    >
      {showDemo && <DemoBanner />}
      {children}
    </Cabinet>
  );
}
