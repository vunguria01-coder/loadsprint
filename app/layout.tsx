import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { PWARegister } from "@/components/pwa-register";
import { VoiceAssistant } from "@/components/voice-assistant";
import { currentUser } from "@/lib/guard";

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

export const metadata: Metadata = {
  title: "LoadSprint — Reliable Freight Solutions Across America",
  description:
    "LoadSprint connects shippers and carriers with fast, efficient, and cost-effective transportation services. Get a freight quote or join our carrier network today.",
  keywords: [
    "freight brokerage",
    "logistics",
    "FTL",
    "LTL",
    "freight quote",
    "carrier network",
    "trucking",
  ],
  metadataBase: new URL("https://loadsprint.com"),
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
    title: "LoadSprint — Moving Freight Faster",
    description:
      "Nationwide freight brokerage connecting shippers with a trusted carrier network. Fast quotes, real-time tracking, 98% on-time delivery.",
    siteName: "LoadSprint",
    type: "website",
  },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "LoadSprint",
  slogan: "Moving Freight Faster",
  description:
    "Freight brokerage and logistics platform connecting shippers with reliable carriers across the United States.",
  areaServed: "US",
  telephone: "+1-888-555-0142",
  email: "dispatch@loadsprint.com",
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
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700&display=swap"
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
      </body>
    </html>
  );
}
