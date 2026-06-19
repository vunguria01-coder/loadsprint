import { Nav } from "@/components/nav";
import { currentUser } from "@/lib/guard";
import { Hero } from "@/components/hero";
import { Stats } from "@/components/stats";
import { Services } from "@/components/services";
import { WhyChoose } from "@/components/why-choose";
import { HowItWorks } from "@/components/how-it-works";
import { Audience } from "@/components/audience";
import { QuoteForm } from "@/components/quote-form";
import { About } from "@/components/about";
import { Testimonials } from "@/components/testimonials";
import { CarrierForm } from "@/components/carrier-form";
import { FAQ } from "@/components/faq";
import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";

export default async function Home() {
  const me = await currentUser();
  return (
    <>
      <Nav authed={!!me} />
      <main id="home">
        <Hero />
        <Stats />
        <Services />
        <WhyChoose />
        <HowItWorks />
        <Audience />
        <QuoteForm />
        <About />
        <Testimonials />
        <CarrierForm />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
