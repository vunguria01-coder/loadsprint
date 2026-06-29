"use client";

import { useState } from "react";
import { Download, Check, Percent, DollarSign } from "lucide-react";
import { useToast } from "@/components/toast";
import { loadJsPDF, type JsPDFDoc } from "@/components/use-jspdf";

export type SettleLoad = { ref: string; route: string; rate: number };
export type SettleDriver = {
  email: string;
  name: string;
  gross: number;
  count: number;
  loads: SettleLoad[];
  payType: "pct" | "flat";
  payRate: number;
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function computePay(type: "pct" | "flat", rate: number, gross: number, count: number) {
  if (!rate || rate <= 0) return 0;
  return type === "pct" ? (gross * rate) / 100 : rate * count;
}

function DriverSettle({ d, company }: { d: SettleDriver; company: string }) {
  const toast = useToast();
  const [type, setType] = useState<"pct" | "flat">(d.payType);
  const [rate, setRate] = useState<string>(d.payRate ? String(d.payRate) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [making, setMaking] = useState(false);

  const rateNum = Number(rate) || 0;
  const pay = computePay(type, rateNum, d.gross, d.count);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/driver-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: d.email, type, rate: rateNum }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast("Could not save", data.error || "Try again.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadStatement() {
    if (d.count === 0) {
      toast("Nothing to export", "This driver has no delivered loads yet.");
      return;
    }
    setMaking(true);
    try {
      const JsPDF = await loadJsPDF();
      const doc: JsPDFDoc = new JsPDF({ unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 48;

      // Header band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, W, 92, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("DRIVER SETTLEMENT", M, 46);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      doc.text(company || "Carrier", W - M, 40, { align: "right" });
      doc.text(new Date().toLocaleDateString("en-US"), W - M, 56, { align: "right" });

      // Driver block
      let y = 128;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.text("DRIVER", M, y);
      doc.setTextColor(17, 24, 39);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(d.name, M, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(d.email, M, y + 34);

      const basis =
        type === "pct" ? `${rateNum}% of each load` : `${money(rateNum)} per delivered load`;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.text("PAY BASIS", W - M - 200, y, { align: "left" });
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(11);
      doc.text(basis, W - M, y + 18, { align: "right" });

      // Table header
      y += 64;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(M, y, W - M, y);
      y += 18;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8.5);
      doc.text("LOAD", M, y);
      doc.text("ROUTE", M + 70, y);
      doc.text("RATE", W - M - 150, y, { align: "right" });
      doc.text("PAY", W - M, y, { align: "right" });
      y += 8;
      doc.line(M, y, W - M, y);
      y += 18;

      // Rows
      doc.setFontSize(9.5);
      for (const l of d.loads) {
        if (y > H - 90) {
          doc.addPage();
          y = 60;
        }
        const linePay = computePay(type, rateNum, l.rate, 1);
        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "bold");
        doc.text(l.ref || "-", M, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const route = doc.splitTextToSize(l.route || "", W - M - 70 - 170)[0] || "";
        doc.text(route, M + 70, y);
        doc.setTextColor(17, 24, 39);
        doc.text(money(l.rate), W - M - 150, y, { align: "right" });
        doc.setTextColor(22, 101, 52);
        doc.text(money(linePay), W - M, y, { align: "right" });
        y += 22;
      }

      // Totals
      if (y > H - 110) {
        doc.addPage();
        y = 60;
      }
      y += 6;
      doc.setDrawColor(226, 232, 240);
      doc.line(M, y, W - M, y);
      y += 22;
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Gross (delivered)", W - M - 150, y, { align: "right" });
      doc.setTextColor(17, 24, 39);
      doc.text(money(d.gross), W - M, y, { align: "right" });
      y += 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text("Driver pay", W - M - 150, y, { align: "right" });
      doc.setTextColor(22, 101, 52);
      doc.text(money(pay), W - M, y, { align: "right" });

      const safe = (d.name || d.email).replace(/[^a-z0-9]+/gi, "-");
      doc.save(`Settlement-${safe}.pdf`);
    } catch {
      toast("Could not create PDF", "Please try again.");
    } finally {
      setMaking(false);
    }
  }

  return (
    <div className="settle-card">
      <div className="settle-head">
        <div className="drv-av" aria-hidden="true">
          {(d.name || d.email).trim().charAt(0).toUpperCase()}
        </div>
        <div className="settle-id">
          <div className="settle-name">{d.name}</div>
          <div className="settle-mail">{d.email}</div>
        </div>
        <div className="settle-gross">
          <div className="sg-val">{money(d.gross)}</div>
          <div className="sg-label">{d.count} delivered</div>
        </div>
      </div>

      <div className="settle-pay">
        <div className="sp-toggle">
          <button
            type="button"
            className={type === "pct" ? "on" : ""}
            onClick={() => setType("pct")}
          >
            <Percent size={13} /> % of load
          </button>
          <button
            type="button"
            className={type === "flat" ? "on" : ""}
            onClick={() => setType("flat")}
          >
            <DollarSign size={13} /> Flat / load
          </button>
        </div>
        <div className="sp-rate">
          <span className="sp-affix">{type === "pct" ? "%" : "$"}</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={type === "pct" ? "e.g. 25" : "e.g. 500"}
          />
        </div>
        <button type="button" className="btn btn-ghost btn-sm sp-save" onClick={save} disabled={saving}>
          {saving ? "…" : saved ? (<><Check size={15} /> Saved</>) : "Save"}
        </button>
      </div>

      <div className="settle-foot">
        <div className="settle-out">
          <span className="so-label">Driver pay</span>
          <span className="so-val">{money(pay)}</span>
        </div>
        <button type="button" className="pkg-btn" onClick={downloadStatement} disabled={making}>
          <Download size={15} /> {making ? "Preparing…" : "Download statement"}
        </button>
      </div>
    </div>
  );
}

export function SettlementsView({
  drivers,
  company,
}: {
  drivers: SettleDriver[];
  company: string;
}) {
  if (drivers.length === 0) {
    return (
      <div className="home-empty">
        <p>No drivers yet. Add drivers and deliver loads to calculate settlements.</p>
      </div>
    );
  }
  return (
    <div className="settle-list">
      {drivers.map((d) => (
        <DriverSettle key={d.email} d={d} company={company} />
      ))}
    </div>
  );
}
