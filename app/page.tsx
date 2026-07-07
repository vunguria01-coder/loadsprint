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
      <Nav authed={!!me} />
      <main id="home">
        <Hero />
        <Stats />
        <Services />
        <HowItWorks />
        <PricingHome />
        <Testimonials />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
