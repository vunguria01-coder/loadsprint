import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { subDaysLeft } from "@/lib/auth";
import { Cabinet } from "@/components/cabinet";

export async function CabinetServer({
  active,
  children,
}: {
  active?: string;
  children: ReactNode;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  return (
    <Cabinet
      role={me.role}
      name={me.name}
      email={me.email}
      tier={me.tier}
      daysLeft={subDaysLeft(me)}
      planId={me.planId}
      active={active}
    >
      {children}
    </Cabinet>
  );
}
