import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { PWARegister } from "@/components/pwa-register";
import { VoiceAssistant } from "@/components/voice-assistant";
import { currentUser } from "@/lib/guard";

// Lazily referenced so the overlay never lands in a production client bundle;
// the branch below is a build-time constant, so it is dropped outright there.
const DevLiveSync = dynamic(() => import("@/components/dev/live-sync"));

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

// Our own site. `loadsprint.com` belongs to a different product (Flit Box), so
// pointing metadata at it sent shared/canonical links — including /login — to
// someone else's sign-in screen.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://loadsprint.us.com";

export const metadata: Metadata = {
  title: "LoadSprint — Dispatch Software for Carriers & Brokers",
  description:
    "Run your whole dispatch from one place: AI rate-con import, live GPS tracking, a driver mobile app, and one-click broker invoice packets. No setup fees, cancel anytime.",
  keywords: [
    "dispatch software",
    "trucking dispatch",
    "TMS",
    "rate confirmation OCR",
    "load tracking",
    "driver app",
    "carriers",
    "freight brokers",
  ],
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LoadSprint",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "LoadSprint — Run Your Whole Dispatch From One Place",
    description:
      "Dispatch platform for carriers and brokers: AI reads the rate con, drivers run the stops, you track them live, and the broker gets a finished invoice packet in one click.",
    siteName: "LoadSprint",
    type: "website",
    url: SITE_URL,
  },
};

// Prices mirror lib/billing-plans.ts (monthly subscriptions, USD).
const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LoadSprint",
  url: SITE_URL,
  slogan: "Run your whole dispatch from one place",
  description:
    "Dispatch platform for trucking carriers and freight brokers: AI rate-confirmation import, live GPS load tracking, a driver mobile app, and one-click broker invoice packets.",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Transportation Management Software",
  operatingSystem: "Web, iOS, Android",
  areaServed: "US",
  email: "support@loadsprint.us.com",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "19",
    highPrice: "199",
    offerCount: 3,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await currentUser();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body>
        <PWARegister />
        <ToastProvider>{children}</ToastProvider>
        {me && <VoiceAssistant />}
        {process.env.NODE_ENV !== "production" && <DevLiveSync />}
      </body>
    </html>
  );
}
