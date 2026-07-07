"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Boxes } from "lucide-react";

export function Hero() {
  const pathRef = useRef<SVGPathElement>(null);
  const truckRef = useRef<SVGCircleElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const path = pathRef.current;
    const truck = truckRef.current;
    if (!path || !truck || reduce) return;
    const len = path.getTotalLength();
    let raf = 0;
    let start: number | null = null;
    const period = 5200;
    const move = (t: number) => {
      if (start === null) start = t;
      const p = ((t - start) % period) / period;
      const pt = path.getPointAtLength(p * len);
      truck.setAttribute("cx", String(pt.x));
      truck.setAttribute("cy", String(pt.y));
      raf = requestAnimationFrame(move);
    };
    raf = requestAnimationFrame(move);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const routeD =
    "M36,138 C110,150 120,52 200,60 C290,69 300,30 364,40";

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <span className="pill">
            <span className="dot" /> Dispatch software for carriers &amp; brokers
          </span>
          <h1>
            <span>Run your whole</span>
            <span>
              dispatch from <span className="grad-text">one place</span>
            </span>
          </h1>
          <p className="sub">
            AI reads your rate con, your drivers run the stops, and you track them
            live — then send the broker a finished invoice packet in one click.
          </p>
          <div className="hero-cta">
            <a href="/register" className="btn btn-primary">
              Get started <ArrowRight size={17} />
            </a>
            <a href="#how" className="btn btn-ghost">
              See how it works
            </a>
          </div>
          <div className="hero-trust">
            <span className="i">
              <CheckCircle2 size={16} /> <b>AI</b> rate-con import
            </span>
            <span className="i">
              <Clock size={16} /> <b>Live</b> GPS tracking
            </span>
            <span className="i">
              <Boxes size={16} /> <b>1-click</b> broker packets
            </span>
          </div>
        </div>

        <div className="dispatch" aria-label="Live shipment tracking preview">
          <div className="dispatch-top">
            <span className="live">
              <span className="dot" /> Live Tracking
            </span>
            <span className="ref">LOAD #LS-48217</span>
          </div>
          <div className="map-card">
            <svg viewBox="0 0 400 180" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#0D9488" />
                  <stop offset="1" stopColor="#14B8A6" />
                </linearGradient>
              </defs>
              <path className="route-bg" d={routeD} />
              <path ref={pathRef} className="route-line" d={routeD} />
              <g transform="translate(36,138)">
                <circle className="pin-o" r="9" />
                <circle className="pin" r="5" />
              </g>
              <g transform="translate(364,40)">
                <circle className="pin-o" r="9" />
                <circle className="pin" r="5" />
              </g>
              <circle ref={truckRef} className="truck-dot" r="6" cx="36" cy="138" />
            </svg>
          </div>
          <div className="tele">
            <div className="t">
              <div className="k">Origin</div>
              <div className="v" style={{ fontSize: 16 }}>
                Dallas, TX
              </div>
            </div>
            <div className="t">
              <div className="k">Distance</div>
              <div className="v">
                642 <small>mi</small>
              </div>
            </div>
            <div className="t">
              <div className="k">Destination</div>
              <div className="v" style={{ fontSize: 16 }}>
                Atlanta, GA
              </div>
            </div>
          </div>
          <div className="dispatch-foot">
            <span>
              Carrier: <b>Sprint Logistics LLC</b> · 53′ Dry Van
            </span>
            <span className="eta-badge">ETA on time</span>
          </div>
        </div>
      </div>
    </section>
  );
}
