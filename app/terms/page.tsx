import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { currentUser } from "@/lib/guard";

export const metadata: Metadata = {
  title: "Terms of Service — LoadSprint",
  description: "The terms that govern your use of LoadSprint.",
};

export default async function TermsPage() {
  const me = await currentUser();
  return (
    <>
      <Nav authed={!!me} />
      <main className="wrap" style={{ maxWidth: 820, padding: "48px 20px 80px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>Last updated: July 9, 2026</p>

        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the LoadSprint
          website and the LoadSprint Driver mobile application (together, the &ldquo;Service&rdquo;).
          LoadSprint (&ldquo;LoadSprint,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is dispatch software for
          trucking carriers, dispatchers, and the drivers they work with. By creating an account or
          using the Service, you agree to these Terms.
        </p>

        <h2 style={h2}>Eligibility &amp; accounts</h2>
        <p>
          The Service is intended for business use by trucking professionals. You must be at least 18
          and able to enter into a binding agreement. You are responsible for the accuracy of the
          information in your account and for keeping your login credentials secure. You are
          responsible for all activity that happens under your account.
        </p>

        <h2 style={h2}>Acceptable use</h2>
        <ul style={ul}>
          <li>Do not use the Service for any unlawful purpose or to violate the rights of others.</li>
          <li>Do not upload content you do not have the right to share, or that is false or misleading.</li>
          <li>Do not attempt to disrupt, reverse engineer, or gain unauthorized access to the Service.</li>
          <li>Do not resell or provide the Service to third parties except as expressly permitted.</li>
        </ul>

        <h2 style={h2}>Your content</h2>
        <p>
          You retain ownership of the loads, documents, photos, and other information you or your
          team add to the Service (&ldquo;Your Content&rdquo;). You grant us the limited rights needed to
          host, process, and display Your Content so we can provide the Service to you and the people
          in your organization. How we handle personal information is described in our{" "}
          <a href="/privacy" style={{ color: "var(--sky)" }}>Privacy Policy</a>.
        </p>

        <h2 style={h2}>Plans &amp; billing</h2>
        <p>
          Paid plans are billed in advance on a recurring basis and are non-refundable except where
          required by law. You can cancel at any time; cancellation takes effect at the end of the
          current billing period. We may change pricing with reasonable advance notice.
        </p>

        <h2 style={h2}>Service availability</h2>
        <p>
          We work to keep the Service reliable, but it is provided on an &ldquo;as is&rdquo; and
          &ldquo;as available&rdquo; basis. We may modify, suspend, or discontinue features from time to
          time, and we may perform maintenance that temporarily limits availability.
        </p>

        <h2 style={h2}>Disclaimers &amp; limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, LoadSprint disclaims all warranties, express or
          implied, including fitness for a particular purpose. LoadSprint is a tool to help you manage
          dispatch operations; you remain responsible for your business decisions, compliance, and
          records. To the fullest extent permitted by law, our total liability arising out of or
          relating to the Service will not exceed the amount you paid us in the twelve months before
          the claim.
        </p>

        <h2 style={h2}>Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you
          violate these Terms or use the Service in a way that could harm LoadSprint, other users, or
          third parties. You can request deletion of your account and associated data using the
          contact below.
        </p>

        <h2 style={h2}>Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. When we do, we will update the date at the top
          of this page. Your continued use of the Service after changes take effect means you accept
          the updated Terms.
        </p>

        <h2 style={h2}>Contact</h2>
        <p>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:support@loadsprint.us.com" style={{ color: "var(--sky)" }}>support@loadsprint.us.com</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}

const h2 = { fontSize: 21, fontWeight: 700, margin: "30px 0 10px" } as const;
const ul = { margin: "0 0 12px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 } as const;
