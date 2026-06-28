import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { AuthShell } from "@/components/auth-shell";
import { DispatcherGate } from "@/components/dispatcher-gate";

export const metadata: Metadata = {
  title: "Dispatcher invite — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function DispatcherJoinPage() {
  const me = await currentUser();
  // Already signed in as a dispatcher/admin → go straight to the cabinet.
  if (me && (me.role === "dispatcher" || me.role === "admin")) {
    redirect("/drivers");
  }
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <DispatcherGate />
      </Suspense>
    </AuthShell>
  );
}
