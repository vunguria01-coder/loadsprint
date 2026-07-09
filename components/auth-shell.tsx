import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { LogisticsBackdrop } from "@/components/logistics-backdrop";

export function AuthShell({
  children,
  fresh = false,
  premium = false,
}: {
  children: ReactNode;
  fresh?: boolean;
  premium?: boolean;
}) {
  if (premium) {
    return (
      <div className="auth premium">
        <LogisticsBackdrop />

        <div className="auth-top">
          <span />
          <Link href="/" className="back">
            <ArrowLeft size={16} /> Back to site
          </Link>
        </div>

        <div className="auth-main">
          <div className="auth-hero">
            <Link href="/" aria-label="LoadSprint home">
              <Image
                src="/loadsprint-logo.png"
                alt="LoadSprint"
                width={793}
                height={200}
                priority
                style={{ height: 42, width: "auto" }}
              />
            </Link>
            <p className="auth-tagline">Manage Loads. Dispatch Drivers. Grow Faster.</p>
          </div>
          {children}
        </div>

        <footer className="auth-footer">
          <Link href="/privacy">Privacy Policy</Link>
          <span className="dot" aria-hidden="true">·</span>
          <Link href="/terms">Terms</Link>
          <span className="dot" aria-hidden="true">·</span>
          <Link href="/support">Support</Link>
          <span className="dot" aria-hidden="true">·</span>
          <span className="copy">© 2026 LoadSprint</span>
        </footer>
      </div>
    );
  }

  return (
    <div className={`auth${fresh ? " fresh" : ""}`}>
      <div className="auth-top">
        <Link href="/" aria-label="LoadSprint home">
          <Image
            src="/loadsprint-logo.png"
            alt="LoadSprint"
            width={793}
            height={200}
            priority
            style={{ height: 30, width: "auto" }}
          />
        </Link>
        <Link href="/" className="back">
          <ArrowLeft size={16} /> Back to site
        </Link>
      </div>
      <div className="auth-main">{children}</div>
    </div>
  );
}
