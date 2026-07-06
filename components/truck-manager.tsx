"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/toast";

type DriverOpt = { email: string; name: string };

// "Add truck" button + modal. Mirrors DriverManager's fetch/toast/refresh flow.
export function TruckManager({ drivers }: { drivers: DriverOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    unit: "",
    make: "",
    model: "",
    year: "",
    plate: "",
    vin: "",
    driverEmail: "",
    purchasePrice: "",
    purchaseDate: "",
    eldProvider: "none",
    eldVehicleId: "",
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function create() {
    if (!f.name.trim()) {
      toast("Name needed", "Give the truck a name or make/model.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not add truck", data.error || "Try again.");
      } else {
        toast("Truck added", `${f.name} is in your fleet.`);
        setOpen(false);
        setF({
          name: "", unit: "", make: "", model: "", year: "", plate: "", vin: "",
          driverEmail: "", purchasePrice: "", purchaseDate: "", eldProvider: "none", eldVehicleId: "",
        });
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={17} /> Add truck
      </button>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="box tm-box" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <b>Add a truck</b>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="tm-body">
              <div className="fgrid">
                <div className="field full">
                  <label>Name / nickname *</label>
                  <input value={f.name} onChange={set("name")} placeholder="e.g. Cascadia 118 or “Blue Peterbilt”" />
                </div>
                <div className="field">
                  <label>Unit #</label>
                  <input value={f.unit} onChange={set("unit")} placeholder="118" />
                </div>
                <div className="field">
                  <label>Assign driver</label>
                  <select value={f.driverEmail} onChange={set("driverEmail")}>
                    <option value="">— none —</option>
                    {drivers.map((d) => (
                      <option key={d.email} value={d.email}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Make</label>
                  <input value={f.make} onChange={set("make")} placeholder="Freightliner" />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input value={f.model} onChange={set("model")} placeholder="Cascadia" />
                </div>
                <div className="field">
                  <label>Year</label>
                  <input value={f.year} onChange={set("year")} inputMode="numeric" placeholder="2021" />
                </div>
                <div className="field">
                  <label>Plate</label>
                  <input value={f.plate} onChange={set("plate")} placeholder="TX 1234ABC" />
                </div>
                <div className="field full">
                  <label>VIN</label>
                  <input value={f.vin} onChange={set("vin")} placeholder="1FUJGLDR..." />
                </div>
                <div className="field">
                  <label>Purchase price ($)</label>
                  <input value={f.purchasePrice} onChange={set("purchasePrice")} inputMode="numeric" placeholder="145000" />
                </div>
                <div className="field">
                  <label>Purchase date</label>
                  <input type="date" value={f.purchaseDate} onChange={set("purchaseDate")} />
                </div>
                <div className="field">
                  <label>ELD provider</label>
                  <select value={f.eldProvider} onChange={set("eldProvider")}>
                    <option value="none">None yet</option>
                    <option value="motive">Motive (KeepTruckin)</option>
                    <option value="samsara">Samsara</option>
                    <option value="geotab">Geotab</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>ELD vehicle ID</label>
                  <input value={f.eldVehicleId} onChange={set("eldVehicleId")} placeholder="provider vehicle id" />
                </div>
              </div>
              <p className="tm-hint">
                ELD is optional — leave it as “None yet”. Location shows from the assigned
                driver’s GPS until a live ELD connection is added.
              </p>
              <div className="tm-foot">
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={create} disabled={busy}>
                  {busy ? "Adding…" : "Add truck"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
