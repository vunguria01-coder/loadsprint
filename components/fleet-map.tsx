"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    L?: any;
  }
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve(window.L);
    document.body.appendChild(s);
  });
}

type FleetDriver = {
  name: string;
  email: string;
  lat: number;
  lng: number;
  at: string;
  active: boolean;
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function FleetMap({ drivers }: { drivers: FleetDriver[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);

  useEffect(() => {
    if (drivers.length === 0) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: false }).setView(
        [drivers[0].lat, drivers[0].lng],
        5
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);

      const pts: [number, number][] = [];
      drivers.forEach((d) => {
        pts.push([d.lat, d.lng]);
        const bg = d.active ? "#38BDF8" : "#94a3b8";
        const ring = d.active ? "rgba(56,189,248,.25)" : "rgba(148,163,184,.2)";
        const icon = L.divIcon({
          className: "",
          html:
            `<div style="width:18px;height:18px;border-radius:50%;background:${bg};` +
            `border:3px solid #0b1120;box-shadow:0 0 0 4px ${ring}"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([d.lat, d.lng], { icon })
          .addTo(m)
          .bindTooltip(`${d.name} · ${ago(d.at)}`, {
            permanent: true,
            direction: "right",
            className: "stop-label",
            offset: [8, -8],
          });
      });

      try {
        if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [44, 44] });
        else m.setView(pts[0], 9);
      } catch {
        /* ignore */
      }
      map.current = m;
      setTimeout(() => m.invalidateSize(), 120);
    });
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [drivers]);

  if (drivers.length === 0) {
    return (
      <div className="panel fleet-empty">
        <h3>Where your drivers are</h3>
        <p className="px">
          No driver locations yet. Once your drivers share GPS from the app, you&apos;ll
          see everyone here — with or without an active load.
        </p>
      </div>
    );
  }

  return (
    <div className="panel fleet-panel">
      <h3>Where your drivers are</h3>
      <p className="px">Last known position for each driver — live whether they&apos;re on a load or not.</p>
      <div className="fleet-map" ref={el} />
      <div className="fleet-legend">
        <span>
          <i className="lg lg-truck" /> On a load
        </span>
        <span>
          <i className="fleet-idle" /> Idle
        </span>
      </div>
    </div>
  );
}
