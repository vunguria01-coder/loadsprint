type Stop = { id: string; kind: "pickup" | "dropoff"; address: string; time?: string; done?: boolean };

export type CurrentLoad = {
  id: string;
  ref: string;
  status: string;
  originName: string;
  destName: string;
  stops?: Stop[];
  pickupApptAt?: string;
  deliveryApptAt?: string;
};

function fmtAppt(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DriverCurrentLoad({ load }: { load: CurrentLoad | null }) {
  if (!load) {
    return (
      <div className="panel">
        <h3>Current load</h3>
        <p className="px" style={{ marginTop: 8, marginBottom: 0 }}>
          Not on an active load right now.
        </p>
      </div>
    );
  }

  const pickedUp = load.status !== "Assigned";
  const delivered = load.status === "Delivered" || load.status === "Closed";

  const stops: Stop[] =
    load.stops && load.stops.length > 0
      ? load.stops
      : [
          { id: "pickup", kind: "pickup", address: load.originName, time: load.pickupApptAt, done: pickedUp },
          { id: "dropoff", kind: "dropoff", address: load.destName, time: load.deliveryApptAt, done: delivered },
        ];

  const now = Date.now();

  return (
    <div className="panel">
      <h3>
        Current load <span className="status-chip" style={{ marginLeft: 4 }}>{load.status}</span>
      </h3>
      <p className="px" style={{ marginTop: 4 }}>{load.ref}</p>
      <div className="dc-timeline" style={{ marginTop: 4 }}>
        {stops.map((s) => {
          const late = !s.done && !!s.time && new Date(s.time).getTime() < now;
          const cls = s.done ? "done" : late ? "warn" : "";
          const appt = fmtAppt(s.time);
          return (
            <div key={s.id} className={`dc-tl-item${cls ? ` ${cls}` : ""}`}>
              <div className="dc-tl-dot" />
              <div className="dc-tl-body">
                <div className="dc-tl-kind">{s.kind === "pickup" ? "Pickup" : "Delivery"}</div>
                <div className="dc-tl-addr">{s.address}</div>
                {appt && (
                  <div className="dc-tl-time">
                    {appt}
                    {late ? " · running late" : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
