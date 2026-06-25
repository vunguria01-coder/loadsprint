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

      // route line origin -> dest
      L.polyline(
        [
          [load.origin.lat, load.origin.lng],
          [load.dest.lat, load.dest.lng],
        ],
        { color: "#2563EB", weight: 2, opacity: 0.4, dashArray: "6 8" }
      ).addTo(m);

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
      <div className="lmap" ref={mapEl} />
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
