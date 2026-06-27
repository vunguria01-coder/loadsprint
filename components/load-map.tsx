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
  const [copiedCity, setCopiedCity] = useState("");
  const [routeMiles, setRouteMiles] = useState<number | null>(null);
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

  function recenterDriver() {
    if (map.current) {
      map.current.setView([pointRef.current.lat, pointRef.current.lng], 11, { animate: true });
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
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(m);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.9 }
      ).addTo(m);

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

      // Real truck route line (origin -> dest), drawn as soon as it loads.
      fetch(`/api/loads/${load.id}/route-line`)
        .then((r) => r.json())
        .then((d) => {
          if (!map.current || !d.ok || !Array.isArray(d.points) || d.points.length < 2) return;
          if (typeof d.distanceMeters === "number") setRouteMiles(d.distanceMeters / 1609.34);
          const latlngs = d.points.map((p: { lat: number; lng: number }) => [p.lat, p.lng]);
          routeLine.current = L.polyline(latlngs, {
            color: "#38BDF8",
            weight: 4,
            opacity: 0.9,
          }).addTo(map.current);
          try {
            map.current.fitBounds(routeLine.current.getBounds(), { padding: [40, 40] });
          } catch {
            /* ignore */
          }
        })
        .catch(() => {});

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
                <span className="addr-val">{load.originName}</span>
              </div>
              <div className="addr-line">
                <span className="addr-tag">Delivery</span>
                <span className="addr-val">{load.destName}</span>
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
        <button type="button" className="recenter-btn" onClick={recenterDriver} title="Center on driver">
          🎯 Driver
        </button>
        {copiedCity && <div className="copied-toast">📍 {copiedCity} — copied</div>}
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
            🚛 {(load.remainingMeters / 1609.34).toFixed(0)} mi left · ETA ~
            {new Date(Date.now() + load.etaSeconds * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}

      {/* Live tracking summary: Origin · Distance · Destination */}
      <div className="track-block">
        <div className="track-cell">
          <span className="track-label">Origin</span>
          <b className="track-val">{load.originName}</b>
        </div>
        <div className="track-cell track-mid">
          <span className="track-label">Distance</span>
          <b className="track-val track-dist">
            {routeMiles != null ? `${routeMiles.toFixed(0)} mi` : "…"}
          </b>
        </div>
        <div className="track-cell">
          <span className="track-label">Destination</span>
          <b className="track-val">{load.destName}</b>
        </div>
      </div>

      {/* Distance from driver's GPS to pickup and delivery */}
      {driverEta?.hasGps && (
        <div className="dist-chips">
          {driverEta.toPickup && (
            <div className="dist-chip">
              <span>To pickup</span>
              <b>{driverEta.toPickup.miles.toFixed(0)} mi · ETA {fmtEta(driverEta.toPickup.etaSeconds)}</b>
            </div>
          )}
          {driverEta.toDelivery && (
            <div className="dist-chip">
              <span>To delivery</span>
              <b>{driverEta.toDelivery.miles.toFixed(0)} mi · ETA {fmtEta(driverEta.toDelivery.etaSeconds)}</b>
            </div>
          )}
        </div>
      )}

      {/* Ask: how far is the driver from any address */}
      <div className="addr-check">
        <div className="addr-check-label">Distance from driver to an address</div>
        <div className="addr-check-row">
          <input
            type="text"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Type an address or city…"
            onKeyDown={(e) => e.key === "Enter" && checkAddress()}
          />
          <button type="button" onClick={checkAddress} disabled={addrBusy || !addr.trim()}>
            {addrBusy ? "…" : "Check"}
          </button>
        </div>
        {addrError && <div className="addr-err">{addrError}</div>}
        {addrResult && (
          <div className="addr-res">
            🚛 <b>{addrResult.miles.toFixed(0)} mi</b> · ETA {fmtEta(addrResult.etaSeconds)} →{" "}
            {addrResult.label}
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
