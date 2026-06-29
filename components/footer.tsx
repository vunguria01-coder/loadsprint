import Image from "next/image";

const social = {
  linkedin:
    "M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0ZM.25 8.25h4.5V24h-4.5zM8 8.25h4.31v2.15h.06c.6-1.14 2.07-2.34 4.26-2.34 4.56 0 5.4 3 5.4 6.9V24h-4.5v-6.99c0-1.67-.03-3.81-2.32-3.81-2.32 0-2.68 1.82-2.68 3.69V24H8z",
  x: "M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-7-6.1 7H1.7l8-9.2L1 2h7l4.8 6.4ZM16.7 20h1.9L7.4 4H5.4z",
  facebook:
    "M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z",
};

function Social({ d, label }: { d: string; label: string }) {
  return (
    <a href="#" aria-label={label}>
      <svg viewBox="0 0 24 24" fill="currentColor" width={17} height={17}>
        <path d={d} />
      </svg>
    </a>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Image
              src="/loadsprint-logo.png"
              alt="LoadSprint"
              width={793}
              height={200}
              style={{ height: 30, width: "auto" }}
            />
            <p>
              Run your whole dispatch from one place — AI rate cons, live driver
              tracking, and one-click broker packets.
            </p>
          </div>
          <div className="foot-col">
            <h5>Product</h5>
            <a href="#services">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="foot-col">
            <h5>Company</h5>
            <a href="#testimonials">Testimonials</a>
            <a href="/privacy">Privacy</a>
          </div>
          <div className="foot-col">
            <h5>Get started</h5>
            <a href="/register">Create account</a>
            <a href="/login">Sign in</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 LoadSprint. All rights reserved.</span>
          <div className="socials">
            <Social d={social.linkedin} label="LinkedIn" />
            <Social d={social.x} label="X" />
            <Social d={social.facebook} label="Facebook" />
          </div>
        </div>
      </div>
    </footer>
  );
}
