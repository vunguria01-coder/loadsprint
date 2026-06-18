import { Reveal } from "@/components/reveal";
import {
  Truck,
  PackageOpen,
  Zap,
  Container,
  Snowflake,
  Layers,
} from "lucide-react";

const services = [
  {
    icon: Truck,
    title: "Full Truckload (FTL)",
    desc: "Dedicated truck capacity for large shipments — your freight, your trailer, direct to destination.",
  },
  {
    icon: PackageOpen,
    title: "Less Than Truckload (LTL)",
    desc: "Affordable shipping for smaller freight — pay only for the space you use, share the rest.",
  },
  {
    icon: Zap,
    title: "Expedited Freight",
    desc: "Time-sensitive deliveries handled with priority dispatch and the fastest available routing.",
  },
  {
    icon: Container,
    title: "Dry Van Shipping",
    desc: "Reliable general freight transportation in enclosed trailers for non-perishable goods.",
  },
  {
    icon: Snowflake,
    title: "Reefer Freight",
    desc: "Temperature-controlled transportation that keeps perishables at the perfect temp end to end.",
  },
  {
    icon: Layers,
    title: "Flatbed Freight",
    desc: "Oversized and specialized cargo loaded with the equipment, permits, and securement it needs.",
  },
];

export function Services() {
  return (
    <section className="section" id="services">
      <div className="wrap">
        <Reveal className="shead">
          <span className="eyebrow">What we move</span>
          <h2 className="h2">
            Freight services for every{" "}
            <span className="grad-text">load type</span>
          </h2>
          <p className="lead">
            From a single pallet to oversized cargo, LoadSprint matches your
            shipment with the right equipment and the right carrier — every time.
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
