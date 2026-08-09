import { timeAgo } from "@/lib/format";

type ActivityLoad = {
  id: string;
  ref: string;
  originName: string;
  destName: string;
  status: string;
  createdAt: string;
  deliveredAt?: string;
};

type Event = { key: string; at: string; done: boolean; title: string; addr: string };

export function DriverActivity({ loads }: { loads: ActivityLoad[] }) {
  const events: Event[] = [];
  for (const l of loads) {
    events.push({
      key: `${l.id}-assigned`,
      at: l.createdAt,
      done: false,
      title: `${l.ref} assigned`,
      addr: `${l.originName} → ${l.destName}`,
    });
    if (l.deliveredAt) {
      events.push({
        key: `${l.id}-delivered`,
        at: l.deliveredAt,
        done: true,
        title: `${l.ref} delivered`,
        addr: `${l.originName} → ${l.destName}`,
      });
    }
  }
  events.sort((a, b) => (a.at < b.at ? 1 : -1));

  if (events.length === 0) {
    return <p className="px">No activity yet for this driver.</p>;
  }

  return (
    <div className="dc-timeline">
      {events.map((e) => (
        <div key={e.key} className={`dc-tl-item${e.done ? " done" : ""}`}>
          <div className="dc-tl-dot" />
          <div className="dc-tl-body">
            <div className="dc-tl-kind">{e.title}</div>
            <div className="dc-tl-addr">{e.addr}</div>
            <div className="dc-tl-time">{timeAgo(e.at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
