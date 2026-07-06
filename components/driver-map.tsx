"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

type Pt = { ref: string; lat: number; lng: number; status: string };

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

export function DriverMap({ points, note }: { points: Pt[]; note?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current || map.current) return;
      const center = points[0] ?? { lat: 39.5, lng: -98.35 };
      const m = L.map(el.current, { zoomControl: true, attributionControl: false }).setView(
        [center.lat, center.lng],
        points.length ? 6 : 4
      );
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(m);
      // Subtle place/road labels on top of the satellite imagery.
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.9 }
      ).addTo(m);
      const mkIcon = (color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #0B1120;box-shadow:0 0 0 2px ${color}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
      // Blue for a live load; gray when we're only showing the last-known point.
      const liveIcon = mkIcon("#38BDF8");
      const idleIcon = mkIcon("#94A3B8");
      const group: any[] = [];
      points.forEach((p) => {
        const icon = p.status === "Last known location" ? idleIcon : liveIcon;
        const mk = L.marker([p.lat, p.lng], { icon }).addTo(m);
        mk.bindPopup(`<b>${p.ref}</b><br>${p.status}`);
        group.push(mk);
      });
      if (group.length > 1) {
        const fg = L.featureGroup(group);
        m.fitBounds(fg.getBounds().pad(0.3));
      }
      map.current = m;
    });
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [points]);

  return (
    <div className="panel">
      <h3>
        <MapPin /> Driver location
      </h3>
      {points.length === 0 ? (
        <p className="px">No location reported yet for this driver.</p>
      ) : (
        <>
          {note && <p className="px" style={{ marginTop: -4 }}>{note}</p>}
          <div ref={el} style={{ height: 320, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }} />
        </>
      )}
    </div>
  );
}
