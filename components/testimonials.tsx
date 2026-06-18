import { Reveal } from "@/components/reveal";
import { Star } from "lucide-react";

const reviews = [
  {
    quote:
      "LoadSprint consistently delivers outstanding service. Our freight shows up on time and we always know where it is.",
    initials: "MR",
    name: "Marcus Reyes",
    role: "Ops Manager, Vantage Goods",
  },
  {
    quote:
      "Their communication and carrier network are excellent. It feels like having a logistics team on staff without the overhead.",
    initials: "DL",
    name: "Dana Liu",
    role: "Supply Chain Lead, Northfield Mfg.",
  },
  {
    quote:
      "Fast, professional, and reliable. When we have a rush load, LoadSprint is the first call we make — every time.",
    initials: "TB",
    name: "Tariq Bell",
    role: "Founder, BellFresh Produce",
  },
];

export function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">Trusted by shippers</span>
          <h2 className="h2">What our partners say</h2>
        </Reveal>
        <div className="quotes">
          {reviews.map((r, i) => (
            <Reveal key={r.name} className="quote" delay={i * 0.06}>
              <div className="stars">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} size={16} />
                ))}
              </div>
              <p>&ldquo;{r.quote}&rdquo;</p>
              <div className="who">
                <div className="av">{r.initials}</div>
                <div>
                  <div className="nm">{r.name}</div>
                  <div className="rl">{r.role}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
