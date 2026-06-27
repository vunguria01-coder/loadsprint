import { Reveal } from "@/components/reveal";
import {
  Sparkles,
  MapPin,
  Smartphone,
  Route,
  FileText,
  ShieldCheck,
} from "lucide-react";

const services = [
  {
    icon: Sparkles,
    title: "AI rate-con import",
    desc: "Drop in a rate confirmation and AI pulls the reference, rate, payer, and every stop — full street addresses with ZIP — in seconds.",
  },
  {
    icon: Route,
    title: "Multi-stop loads",
    desc: "Handle up to 10 pickups and 10 drop-offs on one load, each with its address, date and appointment time, kept in order.",
  },
  {
    icon: MapPin,
    title: "Live GPS tracking",
    desc: "See each driver's real position on the map, plus live distance to the next pickup and to delivery — and which stop they're on right now.",
  },
  {
    icon: Smartphone,
    title: "Driver mobile app",
    desc: "Drivers get their stops, one-tap address copy, the rate confirmation, and cargo & paperwork photos — all on iOS.",
  },
  {
    icon: FileText,
    title: "AI invoices & broker packets",
    desc: "Generate the carrier invoice automatically and download a tidy ZIP — confirmation, photos, a photos PDF, and the invoice — ready to send.",
  },
  {
    icon: ShieldCheck,
    title: "Secure team access",
    desc: "Email + password with a 2FA email code, trusted devices, and roles for dispatchers, drivers and brokers — everyone sees just what they need.",
  },
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
            From the moment a rate con lands to the invoice you send the broker,
            LoadSprint runs the whole load — so you spend less time on paperwork
            and more time moving freight.
          </p>
        </Reveal>
        <div className="cards">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.title} className="card" delay={(i % 3) * 0.06}>
                <div className="ico">
                  <Icon strokeWidth={1.9} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
