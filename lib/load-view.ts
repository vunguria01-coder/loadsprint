import type { Load } from "@/lib/loads";

export type LoadView = Load & {
  point: { lat: number; lng: number };
  canHold: boolean;
  youId: string;
  youRole: string;
  brokerPaused?: boolean;
  brokerPausedLabel?: string;
};
