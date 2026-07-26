import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";

export function FinalCta() {
  return (
    <section className="section">
      <div className="wrap">
        <Reveal className="final-cta">
          <span className="fc-glow" aria-hidden />
          <span className="pill fc-pill">
            <span className="dot" /> Free to set up · cancel anytime
          </span>
          <h2>
            Run your whole dispatch from <span className="grad-text">one place</span>
          </h2>
          <p>
            Import a rate con, track your drivers live, and send the broker a finished
            packet — start in minutes.
          </p>
          <div className="final-cta-btns">
            <a href="/register" className="btn btn-primary">
              Registration <ArrowRight size={17} />
            </a>
            <a href="#how" className="btn btn-ghost">
              See how it works
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
