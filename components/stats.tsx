import { Reveal } from "@/components/reveal";
import { Counter } from "@/components/counter";

const stats = [
  { to: 10000, suffix: "+", label: "Loads Delivered" },
  { to: 500, suffix: "+", label: "Trusted Carriers" },
  { to: 98, suffix: "%", label: "On-Time Delivery" },
  { text: "24/7", label: "Dispatch Support" },
];

export function Stats() {
  return (
    <section className="stats">
      <div className="wrap">
        {stats.map((s, i) => (
          <Reveal key={i} className="stat" delay={i * 0.05}>
            <div className="num">
              <Counter to={s.to} suffix={s.suffix} text={s.text} />
            </div>
            <div className="lbl">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
