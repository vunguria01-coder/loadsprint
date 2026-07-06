"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CreditCard, Settings2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { money } from "@/lib/format";
import type { Truck } from "@/lib/trucks";
import {
  EXPENSE_KINDS,
  EXPENSE_LABELS,
  ELD_PROVIDERS,
  ELD_LABELS,
  TRUCK_STATUSES,
  STATUS_LABELS,
  DOC_KINDS,
  DOC_LABELS,
  MAINT_KINDS,
  MAINT_LABELS,
  type ExpenseKind,
  type DocKind,
  type MaintKind,
} from "@/lib/truck-constants";

function daysUntil(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  const exp = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(ymd);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((exp.getTime() - t0) / 86_400_000);
}

type DriverOpt = { email: string; name: string };

export function TruckDetail({
  truck,
  drivers,
  driverName,
  incomeNote,
}: {
  truck: Truck;
  drivers: DriverOpt[];
  driverName: string | null;
  incomeNote: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Expense form
  const [ex, setEx] = useState({
    kind: "repair" as ExpenseKind,
    amount: "",
    date: "",
    note: "",
    odometer: "",
    gallons: "",
    fuelCardId: "",
  });
  // Fuel card form
  const [fc, setFc] = useState({ label: "", provider: "", last4: "", note: "" });
  // Compliance document form
  const [doc, setDoc] = useState({ kind: "insurance" as DocKind, expiryDate: "", note: "" });
  // Maintenance schedule form
  const [mnt, setMnt] = useState({
    kind: "oil" as MaintKind,
    intervalMiles: "",
    lastServiceMiles: "",
    lastServiceDate: "",
    note: "",
  });

  const odometer = truck.expenses.reduce((m, e) => Math.max(m, e.odometer || 0), 0);

  async function post(url: string, method: string, body: object, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast("Something went wrong", data.error || "Try again.");
        return false;
      }
      if (ok) toast(ok, "");
      router.refresh();
      return true;
    } catch {
      toast("Network error", "Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addExpense() {
    const amt = Number(ex.amount);
    if (!amt || amt <= 0) {
      toast("Enter an amount", "How much did it cost?");
      return;
    }
    const ok = await post(`/api/trucks/${truck.id}/expense`, "POST", ex, "Expense logged");
    if (ok) setEx({ kind: ex.kind, amount: "", date: "", note: "", odometer: "", gallons: "", fuelCardId: "" });
  }

  async function addCard() {
    if (!fc.label.trim()) {
      toast("Name the card", "e.g. Comdata or EFS.");
      return;
    }
    const ok = await post(`/api/trucks/${truck.id}/fuel-card`, "POST", fc, "Fuel card added");
    if (ok) setFc({ label: "", provider: "", last4: "", note: "" });
  }

  async function patch(body: object, ok: string) {
    await post(`/api/trucks/${truck.id}`, "PATCH", body, ok);
  }

  async function addDoc() {
    if (!doc.expiryDate) {
      toast("Add an expiry date", "When does this document expire?");
      return;
    }
    const ok = await post(`/api/trucks/${truck.id}/doc`, "POST", doc, "Document added");
    if (ok) setDoc({ kind: doc.kind, expiryDate: "", note: "" });
  }

  async function addMaint() {
    if (!mnt.intervalMiles || Number(mnt.intervalMiles) <= 0) {
      toast("Set an interval", "e.g. every 25,000 miles.");
      return;
    }
    const ok = await post(`/api/trucks/${truck.id}/maintenance`, "POST", mnt, "Schedule added");
    if (ok) setMnt({ kind: mnt.kind, intervalMiles: "", lastServiceMiles: "", lastServiceDate: "", note: "" });
  }

  async function removeTruck() {
    if (!confirm(`Delete truck “${truck.name}”? This removes its expenses and fuel cards.`)) return;
    const ok = await post("/api/trucks", "DELETE", { id: truck.id }, "Truck deleted");
    if (ok) router.push("/trucks");
  }

  const expenses = [...truck.expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
  const cardName = (id?: string) => truck.fuelCards.find((c) => c.id === id)?.label;

  return (
    <>
      {/* Settings */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3><Settings2 size={18} /> Truck settings</h3>
        <div className="fgrid">
          <div className="field">
            <label>Assigned driver</label>
            <select
              value={truck.driverEmail || ""}
              onChange={(e) => patch({ driverEmail: e.target.value }, "Driver updated")}
              disabled={busy}
            >
              <option value="">— none —</option>
              {drivers.map((d) => (
                <option key={d.email} value={d.email}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select
              value={truck.status}
              onChange={(e) => patch({ status: e.target.value }, "Status updated")}
              disabled={busy}
            >
              {TRUCK_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>ELD provider</label>
            <select
              value={truck.eld.provider}
              onChange={(e) => patch({ eldProvider: e.target.value }, "ELD updated")}
              disabled={busy}
            >
              {ELD_PROVIDERS.map((p) => (
                <option key={p} value={p}>{ELD_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>ELD vehicle ID</label>
            <input
              defaultValue={truck.eld.vehicleId || ""}
              placeholder="provider vehicle id"
              onBlur={(e) => {
                if (e.target.value !== (truck.eld.vehicleId || "")) patch({ eldVehicleId: e.target.value }, "ELD updated");
              }}
              disabled={busy}
            />
          </div>
        </div>

        <details className="tk-help">
          <summary>How do I connect my ELD? (Motive, Samsara, Geotab)</summary>
          <div className="tk-help-body">
            <p>Connecting an ELD lets LoadSprint pull this truck&apos;s live GPS and hours/logbooks straight from your ELD provider.</p>
            <ol>
              <li><b>Pick your provider</b> in the “ELD provider” dropdown above (e.g. Motive).</li>
              <li><b>Find the truck&apos;s Vehicle ID</b> in your ELD portal:
                <ul>
                  <li><b>Motive:</b> Admin → Vehicles → open the truck → copy its <i>Vehicle ID</i>.</li>
                  <li><b>Samsara:</b> Fleet → Vehicles → open the vehicle → <i>Vehicle ID</i>.</li>
                  <li><b>Geotab:</b> Vehicles → open the vehicle → the device / ID.</li>
                </ul>
              </li>
              <li><b>Paste it</b> into “ELD vehicle ID” above and click away — it saves automatically.</li>
              <li><b>Go live:</b> live logbooks &amp; GPS switch on once your ELD API key is connected for your account (ask LoadSprint to enable it). Until then, the truck&apos;s location shows from the assigned driver&apos;s phone GPS.</li>
            </ol>
          </div>
        </details>
      </div>

      {/* Expenses */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Expenses</h3>
        <p className="px">{incomeNote}</p>

        <div className="fgrid tx-form">
          <div className="field">
            <label>Type</label>
            <select value={ex.kind} onChange={(e) => setEx((s) => ({ ...s, kind: e.target.value as ExpenseKind }))}>
              {EXPENSE_KINDS.map((k) => (
                <option key={k} value={k}>{EXPENSE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Amount ($)</label>
            <input value={ex.amount} onChange={(e) => setEx((s) => ({ ...s, amount: e.target.value }))} inputMode="numeric" placeholder="850" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={ex.date} onChange={(e) => setEx((s) => ({ ...s, date: e.target.value }))} />
          </div>
          {ex.kind === "fuel" && (
            <>
              <div className="field">
                <label>Gallons</label>
                <input value={ex.gallons} onChange={(e) => setEx((s) => ({ ...s, gallons: e.target.value }))} inputMode="numeric" placeholder="110" />
              </div>
              <div className="field">
                <label>Fuel card</label>
                <select value={ex.fuelCardId} onChange={(e) => setEx((s) => ({ ...s, fuelCardId: e.target.value }))}>
                  <option value="">— none —</option>
                  {truck.fuelCards.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}{c.last4 ? ` ••${c.last4}` : ""}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="field">
            <label>Odometer</label>
            <input value={ex.odometer} onChange={(e) => setEx((s) => ({ ...s, odometer: e.target.value }))} inputMode="numeric" placeholder="512340" />
          </div>
          <div className="field full">
            <label>Note</label>
            <input value={ex.note} onChange={(e) => setEx((s) => ({ ...s, note: e.target.value }))} placeholder="Front brakes + rotors at Love's" />
          </div>
        </div>
        <div className="tx-add">
          <button className="btn btn-primary btn-sm" onClick={addExpense} disabled={busy}>
            <Plus size={15} /> Add expense
          </button>
        </div>

        <div className="tx-list">
          {expenses.length === 0 ? (
            <div className="tx-empty">No expenses logged yet.</div>
          ) : (
            expenses.map((e) => (
              <div className="tx-row" key={e.id}>
                <span className={`tx-tag k-${e.kind}`}>{EXPENSE_LABELS[e.kind]}</span>
                <div className="tx-mid">
                  <div className="tx-note">{e.note || EXPENSE_LABELS[e.kind]}</div>
                  <div className="tx-meta">
                    {e.date}
                    {e.gallons ? ` · ${e.gallons} gal` : ""}
                    {e.fuelCardId && cardName(e.fuelCardId) ? ` · ${cardName(e.fuelCardId)}` : ""}
                    {e.odometer ? ` · ${e.odometer.toLocaleString("en-US")} mi` : ""}
                  </div>
                </div>
                <span className="tx-amt">{money(e.amount)}</span>
                <button
                  className="tx-del"
                  title="Remove"
                  onClick={() => post(`/api/trucks/${truck.id}/expense`, "DELETE", { expenseId: e.id }, "Expense removed")}
                  disabled={busy}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fuel cards */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3><CreditCard size={18} /> Fuel cards</h3>
        <details className="tk-help">
          <summary>How fuel cards work</summary>
          <div className="tk-help-body">
            <p>Fuel cards let you record which card paid for each fill-up and keep fuel spend tidy.</p>
            <ol>
              <li><b>Add a card</b> below: enter its name (e.g. Comdata, EFS, WEX), and optionally the provider, last 4 digits and a note. Click <b>Add fuel card</b>.</li>
              <li><b>Use it on a fuel expense:</b> in the Expenses section, set <b>Type = Fuel</b>, then pick the card in the <b>Fuel card</b> dropdown (add gallons too if you like).</li>
              <li><b>See the totals:</b> fuel rolls up into the truck&apos;s Fuel figure and the monthly/yearly reports, and each fill-up shows which card paid for it.</li>
            </ol>
            <p className="tk-help-note">Tip: only the card name and last 4 are stored — never the full card number or PIN.</p>
          </div>
        </details>
        <div className="fgrid tx-form">
          <div className="field">
            <label>Card name *</label>
            <input value={fc.label} onChange={(e) => setFc((s) => ({ ...s, label: e.target.value }))} placeholder="Comdata" />
          </div>
          <div className="field">
            <label>Provider</label>
            <input value={fc.provider} onChange={(e) => setFc((s) => ({ ...s, provider: e.target.value }))} placeholder="Comdata / EFS / WEX" />
          </div>
          <div className="field">
            <label>Last 4</label>
            <input value={fc.last4} onChange={(e) => setFc((s) => ({ ...s, last4: e.target.value }))} inputMode="numeric" placeholder="1234" maxLength={4} />
          </div>
          <div className="field">
            <label>Note</label>
            <input value={fc.note} onChange={(e) => setFc((s) => ({ ...s, note: e.target.value }))} placeholder="PIN with dispatcher" />
          </div>
        </div>
        <div className="tx-add">
          <button className="btn btn-primary btn-sm" onClick={addCard} disabled={busy}>
            <Plus size={15} /> Add fuel card
          </button>
        </div>
        <div className="tx-list">
          {truck.fuelCards.length === 0 ? (
            <div className="tx-empty">No fuel cards yet.</div>
          ) : (
            truck.fuelCards.map((c) => (
              <div className="tx-row" key={c.id}>
                <span className="tx-tag k-fuel"><CreditCard size={13} /></span>
                <div className="tx-mid">
                  <div className="tx-note">{c.label}{c.last4 ? ` ••${c.last4}` : ""}</div>
                  <div className="tx-meta">{[c.provider, c.note].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <button
                  className="tx-del"
                  title="Remove"
                  onClick={() => post(`/api/trucks/${truck.id}/fuel-card`, "DELETE", { cardId: c.id }, "Card removed")}
                  disabled={busy}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Compliance documents */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Compliance &amp; documents</h3>
        <p className="px">Insurance, registration, IFTA, inspections — get reminded before they expire.</p>
        <div className="fgrid tx-form">
          <div className="field">
            <label>Document</label>
            <select value={doc.kind} onChange={(e) => setDoc((s) => ({ ...s, kind: e.target.value as DocKind }))}>
              {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Expires</label>
            <input type="date" value={doc.expiryDate} onChange={(e) => setDoc((s) => ({ ...s, expiryDate: e.target.value }))} />
          </div>
          <div className="field full">
            <label>Note</label>
            <input value={doc.note} onChange={(e) => setDoc((s) => ({ ...s, note: e.target.value }))} placeholder="Policy #, carrier, etc." />
          </div>
        </div>
        <div className="tx-add">
          <button className="btn btn-primary btn-sm" onClick={addDoc} disabled={busy}><Plus size={15} /> Add document</button>
        </div>
        <div className="tx-list">
          {truck.docs.length === 0 ? (
            <div className="tx-empty">No documents tracked yet.</div>
          ) : (
            [...truck.docs].sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1)).map((d) => {
              const dl = daysUntil(d.expiryDate);
              const cls = dl < 0 ? "bad" : dl <= 30 ? "warn" : "";
              return (
                <div className="tx-row" key={d.id}>
                  <span className="tx-tag k-other">{DOC_LABELS[d.kind]}</span>
                  <div className="tx-mid">
                    <div className="tx-note">{d.note || DOC_LABELS[d.kind]}</div>
                    <div className="tx-meta">Expires {d.expiryDate}</div>
                  </div>
                  <span className={`ar-days ${cls}`}>
                    {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? "today" : `${dl}d left`}
                  </span>
                  <button className="tx-del" title="Remove" disabled={busy}
                    onClick={() => post(`/api/trucks/${truck.id}/doc`, "DELETE", { docId: d.id }, "Removed")}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Maintenance schedule */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Maintenance schedule</h3>
        <p className="px">
          Mileage-based service. Current odometer: <b>{odometer > 0 ? odometer.toLocaleString("en-US") + " mi" : "—"}</b>
          {odometer === 0 && " (add an odometer on a fuel/repair expense to enable due-by-miles)"}.
        </p>
        <div className="fgrid tx-form">
          <div className="field">
            <label>Service</label>
            <select value={mnt.kind} onChange={(e) => setMnt((s) => ({ ...s, kind: e.target.value as MaintKind }))}>
              {MAINT_KINDS.map((k) => <option key={k} value={k}>{MAINT_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Every (miles)</label>
            <input value={mnt.intervalMiles} onChange={(e) => setMnt((s) => ({ ...s, intervalMiles: e.target.value }))} inputMode="numeric" placeholder="25000" />
          </div>
          <div className="field">
            <label>Last service odometer</label>
            <input value={mnt.lastServiceMiles} onChange={(e) => setMnt((s) => ({ ...s, lastServiceMiles: e.target.value }))} inputMode="numeric" placeholder="500000" />
          </div>
          <div className="field">
            <label>Last service date</label>
            <input type="date" value={mnt.lastServiceDate} onChange={(e) => setMnt((s) => ({ ...s, lastServiceDate: e.target.value }))} />
          </div>
        </div>
        <div className="tx-add">
          <button className="btn btn-primary btn-sm" onClick={addMaint} disabled={busy}><Plus size={15} /> Add schedule</button>
        </div>
        <div className="tx-list">
          {truck.maintenance.length === 0 ? (
            <div className="tx-empty">No maintenance schedules yet.</div>
          ) : (
            truck.maintenance.map((m) => {
              const has = m.intervalMiles && m.lastServiceMiles != null && odometer > 0;
              const milesLeft = has ? m.intervalMiles! - (odometer - m.lastServiceMiles!) : null;
              const cls = milesLeft == null ? "" : milesLeft <= 0 ? "bad" : milesLeft <= 1500 ? "warn" : "";
              return (
                <div className="tx-row" key={m.id}>
                  <span className="tx-tag k-maintenance">{MAINT_LABELS[m.kind]}</span>
                  <div className="tx-mid">
                    <div className="tx-note">Every {m.intervalMiles?.toLocaleString("en-US")} mi{m.note ? ` · ${m.note}` : ""}</div>
                    <div className="tx-meta">
                      {m.lastServiceMiles != null ? `Last @ ${m.lastServiceMiles.toLocaleString("en-US")} mi` : "No last service"}
                      {m.lastServiceDate ? ` · ${m.lastServiceDate}` : ""}
                    </div>
                  </div>
                  {milesLeft != null && (
                    <span className={`ar-days ${cls}`}>
                      {milesLeft <= 0 ? `${Math.abs(milesLeft).toLocaleString("en-US")} mi over` : `${milesLeft.toLocaleString("en-US")} mi`}
                    </span>
                  )}
                  <button className="tx-del" title="Remove" disabled={busy}
                    onClick={() => post(`/api/trucks/${truck.id}/maintenance`, "DELETE", { itemId: m.id }, "Removed")}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-danger btn-sm" onClick={removeTruck} disabled={busy}>
          <Trash2 size={15} /> Delete truck
        </button>
      </div>
    </>
  );
}
