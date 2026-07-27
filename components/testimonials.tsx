import { Reveal } from "@/components/reveal";
import { Star } from "lucide-react";

const reviews = [
  {
    quote:
      "I used to retype every rate con by hand. Now I drop the PDF in and the stops, rate and bill-to are already filled in — a load takes me under a minute.",
    initials: "MR",
    name: "Marcus Reyes",
    role: "Dispatcher, Vantage Transport LLC",
  },
  {
    quote:
      "Live GPS ended the check calls. I can see exactly where every driver is and give the broker an ETA without picking up the phone.",
    initials: "DL",
    name: "Dana Liu",
    role: "Dispatch Manager, Northfield Carriers",
  },
  {
    quote:
      "The broker packet is the part I'd pay for alone — rate confirmation, POD photos and the invoice in one ZIP. We get paid days sooner.",
    initials: "TB",
    name: "Tariq Bell",
    role: "Owner-operator, BellFreight (6 trucks)",
  },
];

export function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">Trusted by dispatchers &amp; carriers</span>
          <h2 className="h2">What dispatchers say</h2>
        </Reveal>
        <div className="quotes">
          {reviews.map((r, i) => (
            <Reveal key={r.name} className="quote" delay={i * 0.06}>
              <span className="qmark" aria-hidden>
                &ldquo;
              </span>
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
