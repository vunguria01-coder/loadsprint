import { Reveal } from "@/components/reveal";
import {
  Globe2,
  MessageSquare,
  BadgeDollarSign,
  MapPin,
  Users,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Globe2,
    title: "Nationwide Coverage",
    desc: "Capacity in all 48 contiguous states, with lanes and carriers wherever your freight needs to go.",
  },
  {
    icon: MessageSquare,
    title: "24/7 Customer Support",
    desc: "Real people on the phone day or night — no tickets in a queue when your load is on the road.",
  },
  {
    icon: BadgeDollarSign,
    title: "Competitive Rates",
    desc: "Transparent, market-driven pricing with no surprise fees — you see the rate before you book.",
  },
  {
    icon: MapPin,
    title: "Real-Time Tracking",
    desc: "Live location and status updates from pickup to delivery, shared with everyone who needs them.",
  },
  {
    icon: Users,
    title: "Experienced Logistics Team",
    desc: "Seasoned brokers who know the lanes, the seasons, and how to solve problems before they grow.",
  },
  {
    icon: ShieldCheck,
    title: "Reliable Carrier Network",
    desc: "Every carrier is vetted, insured, and compliance-checked before they ever touch your freight.",
  },
];

export function WhyChoose() {
  return (
    <section className="section why" id="why">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">Why choose us</span>
          <h2 className="h2">
            A logistics partner built for{" "}
            <span className="grad-text">reliability</span>
          </h2>
          <p className="lead" style={{ marginInline: "auto" }}>
            Speed without the guesswork. Here&apos;s what shippers and carriers
            count on us for.
          </p>
        </Reveal>
        <div className="why-grid">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} className="feat" delay={(i % 2) * 0.06}>
                <div className="fi">
                  <Icon strokeWidth={1.9} />
                </div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
