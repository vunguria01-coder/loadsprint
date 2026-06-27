import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { currentUser } from "@/lib/guard";

export const metadata: Metadata = {
  title: "Privacy Policy — LoadSprint",
  description: "How LoadSprint collects, uses, and protects your information.",
};

export default async function PrivacyPage() {
  const me = await currentUser();
  return (
    <>
      <Nav authed={!!me} />
      <main className="wrap" style={{ maxWidth: 820, padding: "48px 20px 80px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>Last updated: June 27, 2026</p>

        <p>
          This Privacy Policy explains how LoadSprint (&ldquo;LoadSprint,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects,
          uses, and protects information when you use the LoadSprint website and the LoadSprint
          Driver mobile application (together, the &ldquo;Service&rdquo;). LoadSprint is dispatch software
          for trucking carriers, dispatchers, and the drivers they work with.
        </p>

        <h2 style={h2}>Information we collect</h2>
        <p>We collect only what we need to run the dispatch service:</p>
        <ul style={ul}>
          <li><b>Account information</b> — your name, email address, and a securely hashed password. We never store your password in plain text.</li>
          <li><b>Load information</b> — details you or your dispatcher enter or import, such as reference numbers, pickup and drop-off addresses, appointment times, rate, and broker/payer details.</li>
          <li><b>Documents and photos</b> — rate confirmations, cargo photos, and proof-of-delivery paperwork you upload or capture for a load.</li>
          <li><b>Location</b> — if you are a driver and you turn location sharing on, the app sends your device&rsquo;s GPS position to your dispatcher while the app is open. You can turn this off at any time, and we do not track your location in the background.</li>
          <li><b>Basic technical data</b> — standard request information (such as timestamps) needed to operate and secure the Service.</li>
        </ul>

        <h2 style={h2}>How we use information</h2>
        <ul style={ul}>
          <li>To provide the dispatch features you use — creating and assigning loads, tracking progress, generating invoices, and producing broker packets.</li>
          <li>To show a driver&rsquo;s live location to their own dispatcher while location sharing is on.</li>
          <li>To send account and sign-in emails, such as driver invitations and verification codes.</li>
          <li>To secure accounts, prevent abuse, and keep the Service working.</li>
        </ul>

        <h2 style={h2}>How information is shared</h2>
        <p>
          Information is visible to the people in your own organization who need it — for example,
          a driver&rsquo;s loads, photos, and shared location are visible to their assigned dispatcher.
          We do <b>not</b> sell your personal information, and we do not show third-party ads.
        </p>
        <p>We use a small number of trusted service providers to operate the Service:</p>
        <ul style={ul}>
          <li><b>Hosting</b> — our application and data are hosted on cloud infrastructure (Railway).</li>
          <li><b>Email delivery</b> — sign-in and invitation emails are sent through an email provider (Resend).</li>
          <li><b>Maps & geocoding</b> — addresses may be converted to map coordinates through a mapping provider to display routes and distances.</li>
        </ul>
        <p>
          These providers process data only to provide their service to us. We may also disclose
          information if required by law.
        </p>

        <h2 style={h2}>Data retention</h2>
        <p>
          We keep account and load information for as long as your account is active or as needed to
          provide the Service. You can ask us to delete your account and associated personal data
          using the contact below.
        </p>

        <h2 style={h2}>Security</h2>
        <p>
          We use industry-standard measures to protect your information, including encrypted
          connections (HTTPS), hashed passwords, and signed session tokens. No method of transmission
          or storage is completely secure, but we work to protect your data.
        </p>

        <h2 style={h2}>Children&rsquo;s privacy</h2>
        <p>
          The Service is intended for business use by professionals and is not directed to children
          under 13. We do not knowingly collect information from children.
        </p>

        <h2 style={h2}>Your choices</h2>
        <ul style={ul}>
          <li>Turn off location sharing at any time in the driver app.</li>
          <li>Request access to, correction of, or deletion of your personal data by contacting us.</li>
        </ul>

        <h2 style={h2}>Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we do, we will update the date at
          the top of this page.
        </p>

        <h2 style={h2}>Contact</h2>
        <p>
          If you have questions about this Privacy Policy or your data, contact us at{" "}
          <a href="mailto:support@loadsprint.us.com" style={{ color: "var(--sky)" }}>support@loadsprint.us.com</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}

const h2 = { fontSize: 21, fontWeight: 700, margin: "30px 0 10px" } as const;
const ul = { margin: "0 0 12px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 } as const;
