import "./landing.css";
import { Nav } from "@/components/nav";
import { currentUser } from "@/lib/guard";
import { Hero } from "@/components/hero";
import { Stats } from "@/components/stats";
import { Services } from "@/components/services";
import { HowItWorks } from "@/components/how-it-works";
import { PricingHome } from "@/components/pricing-home";
import { Testimonials } from "@/components/testimonials";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";

export default async function Home() {
  const me = await currentUser();
  return (
    <div className="site-fresh">
      <Nav authed={!!me} role={me?.role} />
      <main id="home">
        <Hero authed={!!me} role={me?.role} />
        <Stats />
        <Services />
        <HowItWorks />
        <PricingHome authed={!!me} role={me?.role} />
        <Testimonials />
        <FinalCta authed={!!me} role={me?.role} />
      </main>
      <Footer />
    </div>
  );
}
