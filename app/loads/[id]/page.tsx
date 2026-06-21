import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { hasActiveSub } from "@/lib/auth";
import { getLoadById } from "@/lib/loads";
import { AppHeader } from "@/components/app-header";
import { LoadWorkspace } from "@/components/load-workspace";

export const metadata: Metadata = {
  title: "Load — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function LoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if ((me.role === "dispatcher" || me.role === "broker") && !hasActiveSub(me)) {
    redirect("/pricing");
  }
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) redirect("/loads");

  const ok =
    me.role === "admin" ||
    (me.role === "dispatcher" && load.dispatcherId === me.id) ||
    (me.role === "broker" && load.brokerEmail.toLowerCase() === me.email) ||
    load.driverEmail.toLowerCase() === me.email;
  if (!ok) redirect("/loads");

  return (
    <>
      <AppHeader back="/loads" backLabel="All loads" role={me.role} />
      <main className="loads-body">
        <LoadWorkspace loadId={id} />
      </main>
    </>
  );
}
