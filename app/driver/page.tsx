import type { Metadata } from "next";
import { currentUser } from "@/lib/guard";
import { AuthShell } from "@/components/auth-shell";
import { DriverGate } from "@/components/driver-gate";
import { DriverApp } from "@/components/driver-app";

export const metadata: Metadata = {
  title: "Driver — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DriverPage() {
  const me = await currentUser();
  if (me && me.role === "driver") {
    return <DriverApp name={me.name} />;
  }
  return (
    <AuthShell>
      <DriverGate />
    </AuthShell>
  );
}
