import { Reveal } from "@/components/reveal";
import { Counter } from "@/components/counter";

const stats = [
  { text: "10+10", label: "Pickups & drop-offs per load" },
  { text: "AI", label: "Reads every rate con" },
  { text: "Live", label: "GPS driver tracking" },
  { text: "1-click", label: "Broker invoice packet" },
];

export function Stats() {
  return (
    <section className="stats">
      <div className="wrap">
        {stats.map((s, i) => (
          <Reveal key={i} className="stat" delay={i * 0.05}>
            <div className="num">
              <Counter text={s.text} />
            </div>
            <div className="lbl">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
