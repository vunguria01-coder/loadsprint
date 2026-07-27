"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ArrowRight, ChevronDown } from "lucide-react";
import type { AccountRole } from "@/lib/auth";
import { homeHref } from "@/lib/home-href";

// The header used to list every section flat. Now *every* navigation link on
// the page lives behind a single "Menu" dropdown, grouped into two columns —
// the top level is just the menu trigger plus the CTAs, which carry the weight.
const menuGroups = [
  {
    title: "Product",
    links: [
      {
        href: "#services",
        label: "Features",
        desc: "Everything a dispatcher needs, in one app",
      },
      {
        href: "#how",
        label: "How it works",
        desc: "Rate con to broker invoice in five steps",
      },
      {
        href: "#testimonials",
        label: "Customers",
        desc: "What carriers and shippers say",
      },
    ],
  },
  {
    title: "Company",
    links: [
      {
        href: "#pricing",
        label: "Pricing",
        desc: "Flat monthly plans, no setup fees",
      },
      {
        href: "/privacy",
        label: "Privacy",
        desc: "How we handle your dispatch data",
      },
      {
        href: "/login",
        label: "Sign in",
        desc: "Jump back into your dashboard",
      },
    ],
  },
];

export function Nav({
  authed = false,
  role,
}: {
  authed?: boolean;
  role?: AccountRole;
}) {
  const home = homeHref(role);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 12);
      setProgress(max > 0 ? Math.min(y / max, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("lock", open);
  }, [open]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!drop) return;
    const onDown = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDrop(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrop(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [drop]);

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
            <div
              className={`nav-drop${drop ? " open" : ""}`}
              ref={dropRef}
              onMouseEnter={() => setDrop(true)}
              onMouseLeave={() => setDrop(false)}
            >
              <button
                type="button"
                className="nav-drop-btn"
                aria-expanded={drop}
                aria-haspopup="true"
                onClick={() => setDrop((d) => !d)}
              >
                Menu <ChevronDown size={15} aria-hidden />
              </button>
              <div className="nav-drop-panel" role="menu">
                {menuGroups.map((g) => (
                  <div className="nav-drop-col" key={g.title}>
                    <span className="ndg-title">{g.title}</span>
                    {/* signed-in visitors get "Dashboard" in the bar instead */}
                    {g.links.filter((l) => !(authed && l.href === "/login")).map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        role="menuitem"
                        onClick={() => setDrop(false)}
                      >
                        <span className="ndl-t">{l.label}</span>
                        <span className="ndl-d">{l.desc}</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </nav>
          <div className="nav-cta">
            {authed ? (
              <a href={home} className="btn btn-primary btn-quote">
                Dashboard
              </a>
            ) : (
              <>
                <a href="/login" className="btn btn-signin btn-quote">
                  Sign in
                </a>
                <a href="/register" className="btn btn-primary btn-quote">
                  Get started
                </a>
              </>
            )}
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
        <span
          className="nav-progress"
          aria-hidden
          style={{ transform: `scaleX(${progress})` }}
        />
      </header>

      <div className={`mobile-menu${open ? " open" : ""}`}>
        {menuGroups.map((g) => (
          <div key={g.title}>
            <span className="mm-label">{g.title}</span>
            {/* the sign-in CTA at the bottom already covers /login on mobile */}
            {g.links.filter((l) => l.href !== "/login").map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </div>
        ))}
        {authed ? (
          <a href={home} className="btn btn-primary" onClick={() => setOpen(false)}>
            Dashboard
          </a>
        ) : (
          <>
            <a
              href="/register"
              className="btn btn-primary"
              onClick={() => setOpen(false)}
            >
              Get started free <ArrowRight size={17} />
            </a>
            <a
              href="/login"
              className="btn btn-signin"
              onClick={() => setOpen(false)}
            >
              Sign in
            </a>
          </>
        )}
      </div>
    </>
  );
}
