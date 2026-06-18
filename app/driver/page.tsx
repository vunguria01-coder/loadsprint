import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { AuthShell } from "@/components/auth-shell";
import { DriverGate } from "@/components/driver-gate";

export const metadata: Metadata = {
  title: "Driver — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DriverPage() {
  const me = await currentUser();
  if (me && me.role === "driver") redirect("/loads");
  return (
    <AuthShell>
      <DriverGate />
    </AuthShell>
  );
}
