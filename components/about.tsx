import { Reveal } from "@/components/reveal";

export function About() {
  return (
    <section className="section why" id="about">
      <div className="wrap">
        <Reveal className="shead" >
          <span className="eyebrow">Our story</span>
          <h2 className="h2">
            Freight, made <span className="grad-text">simple</span>
          </h2>
          <p className="lead" style={{ marginTop: 18 }}>
            LoadSprint was founded on a simple idea: moving freight shouldn&apos;t
            be complicated. We pair modern logistics technology with a dispatch
            team that actually picks up the phone, so shippers get reliability and
            carriers get steady, well-paid work. Today we move thousands of loads
            across the country — and we treat every single one like it&apos;s our
            only one.
          </p>
        </Reveal>
        <div className="mv">
          <Reveal className="mv-card">
            <div className="k">Mission</div>
            <p>
              To simplify freight transportation through technology, reliability,
              and exceptional service.
            </p>
          </Reveal>
          <Reveal className="mv-card" delay={0.08}>
            <div className="k">Vision</div>
            <p>
              To become a leading freight brokerage partner across North America.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
