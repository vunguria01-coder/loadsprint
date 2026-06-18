import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
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
