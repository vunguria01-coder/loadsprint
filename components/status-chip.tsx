import type { LoadStatus } from "@/lib/loads";

const cls: Record<LoadStatus, string> = {
  Assigned: "st-assigned",
  "Picked Up": "st-picked",
  "In Transit": "st-transit",
  "At Delivery": "st-atdelivery",
  Delivered: "st-delivered",
  Closed: "st-closed",
};

export function StatusChip({ status }: { status: LoadStatus }) {
  return (
    <span className={`st ${cls[status]}`}>
      <i /> {status}
    </span>
  );
}
