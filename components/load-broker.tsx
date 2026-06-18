"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import type { LoadView } from "@/lib/load-view";

export function LoadBroker({
  load,
  mutate,
}: {
  load: LoadView;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(load.brokerName || "");
  const [email, setEmail] = useState(load.brokerEmail || "");
  const [phone, setPhone] = useState(load.brokerPhone || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await mutate({ action: "broker_info", name, email, phone });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>
        <Building2 /> Broker
      </h3>
      <p className="px">
        {load.hasBroker
          ? "This broker has a LoadSprint account."
          : "External broker — enter their contact for invoices and updates."}
      </p>
      <div className="fgrid">
        <div className="field full">
          <label>Broker name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / name" />
        </div>
        <div className="field full">
          <label>Broker email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="broker@email.com"
          />
        </div>
        <div className="field full">
          <label>Broker phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" />
        </div>
      </div>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save broker contact"}
      </button>
    </div>
  );
}
