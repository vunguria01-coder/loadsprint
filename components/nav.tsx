"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X, ArrowRight } from "lucide-react";

const links = [
  { href: "#services", label: "Services" },
  { href: "#why", label: "Why LoadSprint" },
  { href: "#how", label: "How it works" },
  { href: "#carriers", label: "Carriers" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("lock", open);
  }, [open]);

  return (
    <>
      <header className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="wrap nav-inner">
          <a href="#home" className="brand" aria-label="LoadSprint home">
            <Image
              src="/loadsprint-logo.png"
              alt="LoadSprint"
              width={793}
              height={200}
              priority
              style={{ height: 30, width: "auto" }}
            />
          </a>
          <nav className="nav-links" aria-label="Primary">
            {links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="nav-cta">
            <a href="/login" className="btn btn-ghost btn-quote">
              Sign in
            </a>
            <a href="/register" className="btn btn-ghost btn-quote">
              Register
            </a>
            <a href="#quote" className="btn btn-primary btn-quote">
              Get a Quote
            </a>
            <button
              className="burger"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? (
                <X size={18} color="#fff" style={{ margin: "0 auto" }} />
              ) : (
                <>
                  <span />
                  <span />
                  <span />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu${open ? " open" : ""}`}>
        {[...links, { href: "#shippers", label: "Shippers" }].map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <a
          href="/login"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
        >
          Sign in
        </a>
        <a
          href="/register"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
        >
          Register
        </a>
        <a
          href="#quote"
          className="btn btn-primary"
          onClick={() => setOpen(false)}
        >
          Get a Quote <ArrowRight size={17} />
        </a>
      </div>
    </>
  );
}
