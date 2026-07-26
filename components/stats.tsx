import { Reveal } from "@/components/reveal";
import { Counter } from "@/components/counter";
import { Route, Sparkles, MapPin, FileText } from "lucide-react";

const stats = [
  { icon: Route, text: "10+10", label: "Pickups & drop-offs per load" },
  { icon: Sparkles, text: "AI", label: "Reads every rate con" },
  { icon: MapPin, text: "Live", label: "GPS driver tracking" },
  { icon: FileText, text: "1-click", label: "Broker invoice packet" },
];

export function Stats() {
  return (
    <section className="stats">
      <div className="wrap">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={i} className="stat" delay={i * 0.05}>
              <span className="stat-ic" aria-hidden>
                <Icon strokeWidth={1.9} />
              </span>
              <div className="num">
                <Counter text={s.text} />
              </div>
              <div className="lbl">{s.label}</div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
