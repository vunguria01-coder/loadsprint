import type { Metadata } from "next";
import { BrokerPortal } from "@/components/broker-portal";

export const metadata: Metadata = {
  title: "Track load — LoadSprint",
  robots: { index: false, follow: false },
};

export default async function BrokerTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BrokerPortal token={token} />;
}
