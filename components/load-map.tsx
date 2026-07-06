"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Snowflake, Play } from "lucide-react";
import type { LoadView } from "@/lib/load-view";
import { timeAgo, clockTime } from "@/lib/format";

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

// Pull a clean "City, ST" out of a full street address; fall back to the input.
function cityState(addr: string): string {
  if (!addr) return addr;
  const m = addr.match(/([A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  return m ? `${m[1].trim()}, ${m[2]}` : addr;
}

export function LoadMap({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const mainMarker = useRef<any>(null);
  const pointRef = useRef(load.point);
  const routeLine = useRef<any>(null);
  const streetLayer = useRef<any>(null);
  const satImagery = useRef<any>(null);
  const satLabels = useRef<any>(null);
  const [viewMode, setViewMode] = useState<"satellite" | "street">("satellite");
  const [copiedCity, setCopiedCity] = useState("");
  const [driverCity, setDriverCity] = useState("");
  const [routeMiles, setRouteMiles] = useState<number | null>(null);
  const [routeSeconds, setRouteSeconds] = useState<number | null>(null);
  const [driverEta, setDriverEta] = useState<{
    hasGps: boolean;
    toPickup?: { miles: number; etaSeconds: number } | null;
    toDelivery?: { miles: number; etaSeconds: number } | null;
  } | null>(null);
  const [addr, setAddr] = useState("");
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrResult, setAddrResult] = useState<{ label: string; miles: number; etaSeconds: number } | null>(null);
  const [addrError, setAddrError] = useState("");

  // Distance/ETA from the driver's live GPS to pickup and delivery.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/loads/${load.id}/driver-eta`);
        const d = await res.json();
        if (!cancelled && d.ok) setDriverEta(d);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load.id, load.point.lat, load.point.lng]);

  // Reverse-geocode the driver's current position to a readable "City, ST".
  // Bucketed so it only refreshes when the truck actually moves (~2 km).
  const latBucket = Math.round(load.point.lat * 50) / 50;
  const lngBucket = Math.round(load.point.lng * 50) / 50;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/geo/reverse?lat=${load.point.lat}&lng=${load.point.lng}`);
        const d = await res.json();
        if (!cancelled && d.ok && d.cityState) setDriverCity(d.cityState);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latBucket, lngBucket]);

  async function checkAddress() {
    if (!addr.trim()) return;
    setAddrBusy(true);
    setAddrError("");
    setAddrResult(null);
    try {
      const res = await fetch(`/api/loads/${load.id}/driver-eta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr.trim() }),
      });
      const d = await res.json();
      if (d.ok && d.hasGps === false) setAddrError("No live GPS from the driver yet.");
      else if (d.ok) setAddrResult({ label: d.label, miles: d.miles, etaSeconds: d.etaSeconds });
      else setAddrError(d.error || "Could not calculate.");
    } catch {
      setAddrError("Network error.");
    } finally {
      setAddrBusy(false);
    }
  }

  const fmtEta = (sec: number) =>
    new Date(Date.now() + sec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Driving time as "Yh Zm" (or "Zm" under an hour).
  const humanDur = (sec: number) => {
    const m = Math.max(0, Math.round(sec / 60));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };

  function recenterDriver() {
    if (map.current) {
      map.current.setView([pointRef.current.lat, pointRef.current.lng], 11, { animate: true });
    }
  }

  // Zoom out to show the whole route (driver + pickup + stops + delivery).
  function fitRoute() {
    const L = window.L;
    if (!L || !map.current) return;
    if (routeLine.current) {
      try {
        map.current.fitBounds(routeLine.current.getBounds(), { padding: [40, 40] });
        return;
      } catch {
        /* ignore */
      }
    }
    const pts: [number, number][] = [
      [pointRef.current.lat, pointRef.current.lng],
      [load.origin.lat, load.origin.lng],
      [load.dest.lat, load.dest.lng],
    ];
    (load.stops || []).forEach((s) => {
      if (s.point) pts.push([s.point.lat, s.point.lng]);
    });
    try {
      map.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    } catch {
      /* ignore */
    }
  }

  // Toggle between satellite imagery and a clean street map.
  function switchView(next: "satellite" | "street") {
    const L = window.L;
    if (!L || !map.current) return;
    setViewMode(next);
    if (next === "street") {
      if (satImagery.current) map.current.removeLayer(satImagery.current);
      if (satLabels.current) map.current.removeLayer(satLabels.current);
      if (streetLayer.current) streetLayer.current.addTo(map.current);
    } else {
      if (streetLayer.current) map.current.removeLayer(streetLayer.current);
      if (satImagery.current) satImagery.current.addTo(map.current);
      if (satLabels.current) satLabels.current.addTo(map.current);
    }
  }

  async function copyDriverCity() {
    try {
      const p = pointRef.current;
      const res = await fetch(`/api/geo/reverse?lat=${p.lat}&lng=${p.lng}`);
      const d = await res.json();
      if (d.ok && d.cityState) {
        navigator.clipboard?.writeText(d.cityState);
        setCopiedCity(d.cityState);
        if (mainMarker.current) {
          mainMarker.current.bindPopup(`📍 ${d.cityState}`).openPopup();
        }
        setTimeout(() => setCopiedCity(""), 3000);
      }
    } catch {
      /* ignore */
    }
  }
  const internalMarker = useRef<any>(null);
  const internalLayerRef = useRef(false);

  const isInternalUser = load.youRole !== "broker";
  const canEditAddr = load.youRole === "dispatcher" || load.youRole === "admin";
  const [editingAddr, setEditingAddr] = useState(false);
  const [oName, setOName] = useState(load.originName);
  const [dName, setDName] = useState(load.destName);
  const [savingAddr, setSavingAddr] = useState(false);

  async function saveAddresses() {
    setSavingAddr(true);
    try {
      await mutate({ action: "addresses", originName: oName, destName: dName });
      setEditingAddr(false);
    } finally {
      setSavingAddr(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || map.current) return;
      const m = L.map(mapEl.current, { zoomControl: true, attributionControl: false }).setView(
        [load.point.lat, load.point.lng],
        6
      );
      satImagery.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      );
      satLabels.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.9 }
      );
      streetLayer.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      });
      satImagery.current.addTo(m);
      satLabels.current.addTo(m);

      const trailerIcon = L.divIcon({
        className: "",
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#38BDF8;border:3px solid #0b1120;box-shadow:0 0 10px #38BDF8"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      mainMarker.current = L.marker([load.point.lat, load.point.lng], {
        icon: trailerIcon,
      }).addTo(m);
      // Click the driver marker → copy the city/state where they are now.
      mainMarker.current.on("click", copyDriverCity);

      // faint straight reference line origin -> dest
      L.polyline(
        [
          [load.origin.lat, load.origin.lng],
          [load.dest.lat, load.dest.lng],
        ],
        { color: "#2563EB", weight: 2, opacity: 0.25, dashArray: "6 8" }
      ).addTo(m);

      // Ordered, geocoded stops + a truck route that threads through them all,
      // with numbered markers and always-visible address labels.
      const pin = (bg: string, label: string) =>
        L.divIcon({
          className: "",
          html:
            `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;` +
            `border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};` +
            `border:2px solid #0b1120;box-shadow:0 2px 7px rgba(0,0,0,.55)">` +
            `<span style="transform:rotate(45deg);color:#fff;font:700 10px Manrope,system-ui,sans-serif">${label}</span></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
          popupAnchor: [0, -22],
        });
      const tip = {
        permanent: true as const,
        direction: "right" as const,
        className: "stop-label",
        offset: [10, -10] as [number, number],
      };
      const drawFallbackPins = () => {
        if (!map.current) return;
        L.marker([load.origin.lat, load.origin.lng], { icon: pin("#22c55e", "1") })
          .addTo(map.current)
          .bindTooltip(load.originName, tip)
          .bindPopup(`Pickup<br>${load.originName}`);
        L.marker([load.dest.lat, load.dest.lng], { icon: pin("#ef4444", "2") })
          .addTo(map.current)
          .bindTooltip(load.destName, tip)
          .bindPopup(`Delivery<br>${load.destName}`);
      };

      fetch(`/api/loads/${load.id}/waypoints`)
        .then((r) => r.json())
        .then((d) => {
          if (!map.current) return;
          const wps: Array<{ kind: string; address: string; lat: number; lng: number }> =
            d.ok && Array.isArray(d.waypoints) ? d.waypoints : [];
          if (wps.length < 2) {
            drawFallbackPins();
            return;
          }
          if (typeof d.distanceMeters === "number") setRouteMiles(d.distanceMeters / 1609.34);
          if (typeof d.durationSeconds === "number") setRouteSeconds(d.durationSeconds);

          // The line the driver follows: real road route from the driver's
          // position through the remaining stops (HERE), or — if routing is
          // offline — a clean connector that still starts at the driver.
          const linePts: [number, number][] =
            Array.isArray(d.points) && d.points.length >= 2
              ? d.points.map((p: { lat: number; lng: number }) => [p.lat, p.lng])
              : [
                  [pointRef.current.lat, pointRef.current.lng] as [number, number],
                  ...wps.map((w) => [w.lat, w.lng] as [number, number]),
                ];
          routeLine.current = L.polyline(linePts, {
            color: "#38BDF8",
            weight: 4,
            opacity: 0.9,
          }).addTo(map.current);

          // Numbered, labelled marker for every stop in order.
          wps.forEach((w, i) => {
            const isFirst = i === 0;
            const isLast = i === wps.length - 1;
            const bg = isFirst
              ? "#22c55e"
              : isLast
              ? "#ef4444"
              : w.kind === "pickup"
              ? "#22c55e"
              : "#f59e0b";
            const role = isLast ? "Delivery" : w.kind === "pickup" ? "Pickup" : "Drop";
            L.marker([w.lat, w.lng], { icon: pin(bg, String(i + 1)) })
              .addTo(map.current)
              .bindTooltip(w.address, tip)
              .bindPopup(`${i + 1}. ${role}<br>${w.address}`);
          });

          try {
            map.current.fitBounds(routeLine.current.getBounds(), { padding: [44, 44] });
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          drawFallbackPins();
        });

      if (isInternalUser) {
        m.on("click", (e: any) => {
          mutate({ action: "internal", lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }
      map.current = m;
      setTimeout(() => m.invalidateSize(), 100);
    });
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
        mainMarker.current = null;
        internalMarker.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // move main marker when point changes
  useEffect(() => {
    pointRef.current = load.point;
    if (mainMarker.current) {
      mainMarker.current.setLatLng([load.point.lat, load.point.lng]);
    }
  }, [load.point.lat, load.point.lng]);

  // internal marker (dispatcher/driver only)
  useEffect(() => {
    const L = window.L;
    if (!L || !map.current || !isInternalUser) return;
    if (load.internalPoint) {
      const purpleIcon = L.divIcon({
        className: "",
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#a78bfa;border:3px solid #0b1120;box-shadow:0 0 10px #a78bfa"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (!internalMarker.current) {
        internalMarker.current = L.marker(
          [load.internalPoint.lat, load.internalPoint.lng],
          { icon: purpleIcon, draggable: true }
        ).addTo(map.current);
        internalMarker.current.on("dragend", (e: any) => {
          const ll = e.target.getLatLng();
          mutate({ action: "internal", lat: ll.lat, lng: ll.lng });
        });
        internalLayerRef.current = true;
      } else {
        internalMarker.current.setLatLng([
          load.internalPoint.lat,
          load.internalPoint.lng,
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.internalPoint?.lat, load.internalPoint?.lng]);

  const isBroker = load.youRole === "broker";
  const brokerPaused = isBroker && load.brokerPaused;
  const internalParked = !isBroker && load.held;
  const driverPaused = !isBroker && load.driverPaused;
  const showPaused = brokerPaused || internalParked || driverPaused;
  const statusLabel = brokerPaused
    ? `${load.brokerPausedLabel} · last fix ${timeAgo(load.locationUpdatedAt)}`
    : internalParked
    ? `Parked · last fix ${timeAgo(load.heldAt || load.locationUpdatedAt)}`
    : driverPaused
    ? `Driver paused location · last fix ${timeAgo(load.driverLocationAt || load.locationUpdatedAt)}`
    : load.driverPoint
    ? `Live GPS · updated ${timeAgo(load.driverLocationAt || load.locationUpdatedAt)}`
    : `Live · updated ${timeAgo(load.locationUpdatedAt)}`;

  return (
    <div className="panel">
      <h3>
        <MapPin /> Live location
      </h3>
      <p className="px">
        {load.youRole === "broker"
          ? "Current trailer position for this load."
          : "Trailer position shown to the broker."}
      </p>

      {canEditAddr && (
        <div className="addr-edit">
          {!editingAddr ? (
            <div className="addr-view">
              <div className="addr-line">
                <span className="addr-tag">Pickup</span>
                <span className="addr-val">{cityState(load.originName)}</span>
              </div>
              <div className="addr-line">
                <span className="addr-tag">Delivery</span>
                <span className="addr-val">{cityState(load.destName)}</span>
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "7px 12px", marginTop: 6 }}
                onClick={() => {
                  setOName(load.originName);
                  setDName(load.destName);
                  setEditingAddr(true);
                }}
              >
                Edit addresses
              </button>
            </div>
          ) : (
            <div className="addr-form">
              <label>Pickup address</label>
              <input
                value={oName}
                onChange={(e) => setOName(e.target.value)}
                placeholder="123 Main St, Dallas, TX 75201"
              />
              <label>Delivery address</label>
              <input
                value={dName}
                onChange={(e) => setDName(e.target.value)}
                placeholder="456 Oak Ave, Atlanta, GA 30301"
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" style={{ padding: "8px 14px" }} onClick={saveAddresses} disabled={savingAddr}>
                  {savingAddr ? "Saving…" : "Save & re-locate"}
                </button>
                <button className="btn btn-ghost" style={{ padding: "8px 14px" }} onClick={() => setEditingAddr(false)} disabled={savingAddr}>
                  Cancel
                </button>
              </div>
              <p className="hint" style={{ marginTop: 8 }}>
                Saving re-geocodes the addresses, so the map, route and ETA update.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="lmap-wrap">
        <div className="lmap" ref={mapEl} />
        <div className="lmap-tabs">
          <button
            type="button"
            className={viewMode === "satellite" ? "on" : ""}
            onClick={() => switchView("satellite")}
          >
            Satellite
          </button>
          <button
            type="button"
            className={viewMode === "street" ? "on" : ""}
            onClick={() => switchView("street")}
          >
            Map
          </button>
        </div>
        <button type="button" className="lmap-fit" onClick={fitRoute} title="Fit whole route">
          ⤢ Route
        </button>
        <button type="button" className="recenter-btn" onClick={recenterDriver} title="Center on driver">
          ◎ Driver
        </button>
        {copiedCity && <div className="copied-toast">📍 {copiedCity} — copied</div>}
      </div>
      <div className="lmap-legend">
        <span><i className="lg lg-p" /> Pickup</span>
        <span><i className="lg lg-d" /> Delivery</span>
        <span><i className="lg lg-truck" /> Driver</span>
        {isInternalUser && <span><i className="lg lg-int" /> Internal</span>}
      </div>
      <div className="coords">
        <span className="c">
          Lat <b>{load.point.lat.toFixed(4)}</b>
        </span>
        <span className="c">
          Lng <b>{load.point.lng.toFixed(4)}</b>
        </span>
      </div>
      <span className={`upd${showPaused ? " paused" : ""}`}>
        <i />
        {statusLabel}
      </span>

      {typeof load.remainingMeters === "number" &&
        typeof load.etaSeconds === "number" &&
        load.status !== "Delivered" &&
        load.status !== "Closed" && (
          <div className="eta-row">
            🚛 {(load.remainingMeters / 1609.34).toFixed(0)} mi · {humanDur(load.etaSeconds)} to
            delivery · ETA ~{fmtEta(load.etaSeconds)}
          </div>
        )}

      {/* Trip summary: total route distance + the driver's current city. */}
      <div className="trip-strip">
        <div className="track-cell">
          <span className="track-label">To delivery (from driver)</span>
          <b className="track-val track-dist">
            {routeMiles != null
              ? `${routeMiles.toFixed(0)} mi${routeSeconds != null ? ` · ${humanDur(routeSeconds)}` : ""}`
              : "…"}
          </b>
        </div>
        <div className="track-cell trip-right">
          <span className="track-label">Driver now</span>
          <b className="track-val">
            {driverCity || `${load.point.lat.toFixed(2)}, ${load.point.lng.toFixed(2)}`}
          </b>
        </div>
      </div>

      {/* Distance from driver's GPS to pickup and delivery */}
      {driverEta?.hasGps && (
        <div className="dist-chips">
          {driverEta.toPickup && (
            <div className="dist-chip">
              <span>To pickup</span>
              <b>
                {driverEta.toPickup.miles.toFixed(0)} mi · {humanDur(driverEta.toPickup.etaSeconds)} ·
                ETA {fmtEta(driverEta.toPickup.etaSeconds)}
              </b>
            </div>
          )}
          {driverEta.toDelivery && (
            <div className="dist-chip">
              <span>To delivery</span>
              <b>
                {driverEta.toDelivery.miles.toFixed(0)} mi · {humanDur(driverEta.toDelivery.etaSeconds)} ·
                ETA {fmtEta(driverEta.toDelivery.etaSeconds)}
              </b>
            </div>
          )}
        </div>
      )}

      {/* Ask: how far is the driver from any address */}
      <div className="addr-check">
        <div className="addr-check-label">How far is the driver from an address?</div>
        <div className="addr-check-row">
          <input
            type="text"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Pickup, delivery, or any address / city…"
            onKeyDown={(e) => e.key === "Enter" && checkAddress()}
          />
          <button type="button" onClick={checkAddress} disabled={addrBusy || !addr.trim()}>
            {addrBusy ? "…" : "Check"}
          </button>
        </div>
        {addrError && <div className="addr-err">{addrError}</div>}
        {addrResult && (
          <div className="addr-res">
            🚛 <b>{addrResult.miles.toFixed(0)} mi</b> · {humanDur(addrResult.etaSeconds)} · ETA{" "}
            {fmtEta(addrResult.etaSeconds)} → {addrResult.label}
          </div>
        )}
      </div>

      {isInternalUser && load.hasBroker && (
        <label className="sw" style={{ marginTop: 14, display: "flex" }}>
          <input
            type="checkbox"
            checked={load.shareLocationWithBroker}
            onChange={(e) => mutate({ action: "share", value: e.target.checked })}
          />
          <span className="track" />
          <span className="sw-lbl">
            {load.shareLocationWithBroker
              ? "Sharing live location with broker"
              : "Location hidden from broker (shows honest “paused”)"}
          </span>
        </label>
      )}

      {load.canHold && isInternalUser && (
        <div style={{ marginTop: 14 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: "9px 14px" }}
            onClick={() => mutate({ action: "hold", held: !load.held })}
          >
            {load.held ? (
              <>
                <Play size={15} /> Resume live tracking
              </>
            ) : (
              <>
                <Snowflake size={15} /> Pause (privacy hold)
              </>
            )}
          </button>
          <p className="hint">
            Holds the marker at the trailer&apos;s real parked point so the
            driver&apos;s personal movement isn&apos;t broadcast. The broker sees
            an honest &ldquo;Parked&rdquo; status — not a fake live ping.
          </p>
        </div>
      )}

      {isInternalUser && (
        <div className="internal-box">
          <div className="ib-top">
            <div>
              <span className="ib-tag">Internal marker</span>
              <div className="ib-note">
                Dispatcher / driver only — not shared with broker.
              </div>
            </div>
            {load.internalPoint && (
              <span className="ib-active">
                <i /> Active · updated{" "}
                {clockTime(load.internalUpdatedAt || load.locationUpdatedAt)}
              </span>
            )}
          </div>
          <p className="hint">
            Click the map to place it, or drag the purple marker to move it
            anywhere. This is a private working layer.
          </p>
        </div>
      )}
    </div>
  );
}
