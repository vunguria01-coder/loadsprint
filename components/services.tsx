import { Reveal } from "@/components/reveal";
import {
  Sparkles,
  MapPin,
  Smartphone,
  Route,
  FileText,
  ShieldCheck,
  Wallet,
  CalendarClock,
} from "lucide-react";

const services = [
  {
    icon: Sparkles,
    title: "AI rate-con import",
    desc: "Drop in a rate con — AI fills the reference, rate, payer and every stop in seconds.",
    wide: true,
  },
  {
    icon: Route,
    title: "Multi-stop loads",
    desc: "Up to 10 pickups and drop-offs per load, each with its time, kept in order.",
  },
  {
    icon: MapPin,
    title: "Live GPS tracking",
    desc: "See each driver on the map, with live distance to the next stop and delivery.",
  },
  {
    icon: Smartphone,
    title: "Driver mobile app",
    desc: "Drivers get every stop, one-tap addresses, and cargo photos on iOS.",
  },
  {
    icon: FileText,
    title: "AI invoices & broker packets",
    desc: "Auto-build the invoice and one ZIP packet — ready to send the broker.",
  },
  {
    icon: ShieldCheck,
    title: "Secure team access",
    desc: "Email + 2FA, trusted devices, and roles for dispatchers, drivers and brokers.",
  },
  {
    icon: Wallet,
    title: "Settlements & receivables",
    desc: "Track what each driver is owed and which broker invoices are still open.",
  },
  {
    icon: CalendarClock,
    title: "Calendar & reminders",
    desc: "Every pickup and delivery appointment on one calendar, with reminders before each stop.",
  },
];

// Mock of the fields AI pulls off a rate con — shown inside the featured card.
const parsed = [
  { k: "Reference", v: "LS-48217" },
  { k: "Rate", v: "$2,450.00" },
  { k: "Payer", v: "Vantage Goods" },
  { k: "Stops", v: "2 pick · 3 drop" },
];

export function Services() {
  return (
    <section className="section" id="services">
      <div className="wrap">
        <Reveal className="shead">
          <span className="eyebrow">What it does</span>
          <h2 className="h2">
            Everything a dispatcher needs,{" "}
            <span className="grad-text">in one app</span>
          </h2>
          <p className="lead">
            From rate con to broker invoice, LoadSprint runs the whole load — less
            paperwork, more freight.
          </p>
        </Reveal>
        <div className="cards">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal
                key={s.title}
                className={`card${s.wide ? " card-wide" : ""}`}
                delay={(i % 3) * 0.06}
              >
                <div className="ico">
                  <Icon strokeWidth={1.9} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                {s.wide && (
                  <div className="card-demo" aria-hidden>
                    {parsed.map((f) => (
                      <div className="cd-row" key={f.k}>
                        <span className="cd-k">{f.k}</span>
                        <span className="cd-v">{f.v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
