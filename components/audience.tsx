import { Reveal } from "@/components/reveal";
import { Check } from "lucide-react";

const shipperPoints = [
  "Tailored freight solutions for any load size or lane",
  "Cost optimization that protects your margins",
  "Reliable transportation backed by vetted carriers",
  "Dedicated account management from a single point of contact",
];

const carrierPoints = [
  "Consistent freight opportunities on lanes you run",
  "Fast payment options, including quick-pay",
  "Dedicated carrier support from real dispatchers",
  "Easy onboarding — get hauling in minutes",
];

export function Audience() {
  return (
    <section className="section" id="shippers">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">For both sides of the load</span>
          <h2 className="h2">
            Built for shippers <span className="grad-text">and</span> carriers
          </h2>
        </Reveal>
        <div className="aud">
          <Reveal className="aud-card">
            <span className="tag">Shippers</span>
            <h3>Move freight without the stress</h3>
            <ul>
              {shipperPoints.map((p) => (
                <li key={p}>
                  <Check strokeWidth={2.4} /> {p}
                </li>
              ))}
            </ul>
            <a href="#quote" className="btn btn-primary">
              Request Freight Quote
            </a>
          </Reveal>

          <Reveal className="aud-card" delay={0.08}>
            <span id="carriers" className="tag">
              Carriers
            </span>
            <h3>Keep your trucks loaded and paid</h3>
            <ul>
              {carrierPoints.map((p) => (
                <li key={p}>
                  <Check strokeWidth={2.4} /> {p}
                </li>
              ))}
            </ul>
            <a href="#carrier-form" className="btn btn-ghost">
              Join Our Carrier Network
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
