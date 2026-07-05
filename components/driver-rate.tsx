"use client";

import { useState } from "react";

export function DriverRate({
  current,
  mutate,
}: {
  current?: number;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [val, setVal] = useState(current ? String(current) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(clear = false) {
    setBusy(true);
    setMsg("");
    const rate = clear ? 0 : Number(val);
    await mutate({ action: "set_driver_rate", rate });
    setBusy(false);
    setMsg(
      clear ? "Cleared — the driver sees the original." : "Saved \u2713 The driver now sees this rate."
    );
    if (clear) setVal("");
  }

  return (
    <div className="drate">
      <p className="drate-hint">
        Set the pay <b>your driver</b> sees on this load — their app shows this amount and a
        &ldquo;Driver rate sheet&rdquo; PDF. The broker always receives the original rate
        confirmation, unchanged.
      </p>
      <div className="drate-row">
        <div className="drate-input">
          <span>$</span>
          <input
            type="number"
            min={0}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="1500"
          />
        </div>
        <button className="drate-save" onClick={() => save(false)} disabled={busy || !val}>
          {busy ? "…" : "Save"}
        </button>
        {current ? (
          <button className="drate-clear" onClick={() => save(true)} disabled={busy}>
            Clear
          </button>
        ) : null}
      </div>
      {msg && (
        <div className={`drate-msg${msg.includes("\u2713") || msg.includes("Cleared") ? " ok" : ""}`}>
          {msg}
        </div>
      )}
    </div>
  );
}
