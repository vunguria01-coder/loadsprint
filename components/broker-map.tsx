"use client";

import { useEffect, useRef, useState } from "react";

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

type LL = { lat: number; lng: number };
type BStop = { kind: "pickup" | "dropoff"; address: string; lat: number | null; lng: number | null; done?: boolean };

export function BrokerMap({
  point,
  origin,
  dest,
  originName,
  destName,
  stops,
  paused,
}: {
  point: LL;
  origin?: LL;
  dest?: LL;
  originName: string;
  destName: string;
  stops?: BStop[];
  paused?: boolean;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const driver = useRef<any>(null);
  const streetLayer = useRef<any>(null);
  const satLayer = useRef<any>(null);
  const [view, setView] = useState<"street" | "satellite">("street");

  // Build the list of all meaningful points (for fitting bounds + route line).
  function allLatLngs(): [number, number][] {
    const pts: [number, number][] = [[point.lat, point.lng]];
    if (origin) pts.push([origin.lat, origin.lng]);
    (stops || []).forEach((s) => {
      if (typeof s.lat === "number" && typeof s.lng === "number") pts.push([s.lat, s.lng]);
    });
    if (dest) pts.push([dest.lat, dest.lng]);
    return pts;
  }

  function fitAll() {
    const L = window.L;
    if (!L || !map.current) return;
    const pts = allLatLngs();
    if (pts.length >= 2) {
      try {
        map.current.fitBounds(L.latLngBounds(pts), { padding: [38, 38] });
      } catch {
        /* ignore */
      }
    } else {
      map.current.setView([point.lat, point.lng], 9, { animate: true });
    }
  }

  function centerDriver() {
    if (map.current) map.current.setView([point.lat, point.lng], 11, { animate: true });
  }

  function switchView(next: "street" | "satellite") {
    const L = window.L;
    if (!L || !map.current) return;
    setView(next);
    if (next === "satellite") {
      if (streetLayer.current) map.current.removeLayer(streetLayer.current);
      if (satLayer.current) satLayer.current.addTo(map.current);
    } else {
      if (satLayer.current) map.current.removeLayer(satLayer.current);
      if (streetLayer.current) streetLayer.current.addTo(map.current);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || map.current) return;
      const m = L.map(mapEl.current, { zoomControl: true, attributionControl: false }).setView(
        [point.lat, point.lng],
        7
      );

      streetLayer.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      });
      satLayer.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      );
      streetLayer.current.addTo(m);

      const pin = (bg: string, label: string) =>
        L.divIcon({
          className: "",
          html:
            `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;` +
            `border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};` +
            `border:2px solid #0b1120;box-shadow:0 2px 8px rgba(0,0,0,.55)">` +
            `<span style="transform:rotate(45deg);color:#fff;font:700 11px Manrope,system-ui,sans-serif">${label}</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
          popupAnchor: [0, -24],
        });
      const tip = {
        permanent: true as const,
        direction: "right" as const,
        className: "stop-label",
        offset: [10, -10] as [number, number],
      };

      // Ordered waypoints: prefer the real (geocoded) stop list; otherwise just
      // pickup → delivery. Numbered 1..N in driving order.
      const geocoded = (stops || []).filter(
        (s) => typeof s.lat === "number" && typeof s.lng === "number"
      ) as Array<{ kind: "pickup" | "dropoff"; address: string; lat: number; lng: number }>;
      type WP = { address: string; lat: number; lng: number; role: "Pickup" | "Drop" | "Delivery" };
      let wps: WP[] = [];
      if (geocoded.length >= 2) {
        wps = geocoded.map((s, i) => ({
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          role: i === geocoded.length - 1 ? "Delivery" : s.kind === "pickup" ? "Pickup" : "Drop",
        }));
      } else {
        if (origin) wps.push({ address: originName, lat: origin.lat, lng: origin.lng, role: "Pickup" });
        if (dest) wps.push({ address: destName, lat: dest.lat, lng: dest.lng, role: "Delivery" });
      }

      // The line the driver follows, threading the stops in order.
      if (wps.length >= 2) {
        L.polyline(
          wps.map((w) => [w.lat, w.lng]),
          { color: "#38BDF8", weight: 4, opacity: 0.85 }
        ).addTo(m);
      }

      // Numbered, labelled markers (address always visible).
      wps.forEach((w, i) => {
        const bg = w.role === "Delivery" ? "#ef4444" : w.role === "Pickup" ? "#22c55e" : "#f59e0b";
        L.marker([w.lat, w.lng], { icon: pin(bg, String(i + 1)) })
          .addTo(m)
          .bindTooltip(w.address, tip)
          .bindPopup(`${i + 1}. ${w.role}<br>${w.address}`);
      });

      const driverIcon = L.divIcon({
        className: "",
        html:
          '<div style="width:20px;height:20px;border-radius:50%;background:#38BDF8;' +
          'border:3px solid #0b1120;box-shadow:0 0 0 4px rgba(56,189,248,.25),0 0 12px #38BDF8"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      driver.current = L.marker([point.lat, point.lng], { icon: driverIcon })
        .addTo(m)
        .bindPopup("Driver");

      map.current = m;
      setTimeout(() => {
        m.invalidateSize();
        fitAll();
      }, 120);
    });
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
        driver.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the driver marker when the polled point changes.
  useEffect(() => {
    if (driver.current) driver.current.setLatLng([point.lat, point.lng]);
  }, [point.lat, point.lng]);

  return (
    <div>
      <div className="bmap-wrap">
        <div className="bmap" ref={mapEl} />
        <div className="bmap-tabs">
          <button
            type="button"
            className={view === "street" ? "on" : ""}
            onClick={() => switchView("street")}
          >
            Map
          </button>
          <button
            type="button"
            className={view === "satellite" ? "on" : ""}
            onClick={() => switchView("satellite")}
          >
            Satellite
          </button>
        </div>
        <div className="bmap-ctl">
          <button type="button" onClick={fitAll} title="Fit whole route">⤢ Route</button>
          <button type="button" onClick={centerDriver} title="Center on driver">◎ Driver</button>
        </div>
      </div>
      <div className="bmap-legend">
        <span><i className="lg lg-p" /> Pickup</span>
        <span><i className="lg lg-d" /> Delivery</span>
        <span><i className="lg lg-truck" /> Driver{paused ? " (paused)" : ""}</span>
      </div>
    </div>
  );
}
