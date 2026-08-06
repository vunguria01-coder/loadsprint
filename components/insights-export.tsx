"use client";

export type InsightsExportData = {
  rangeLabel: string;
  kpis: { label: string; val: string }[];
  weeks: { label: string; total: number }[];
  drivers: { name: string; loads: number; revenue: number }[];
};

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Client-side CSV generation — same Blob/download-link approach as
// Completed loads, no server round trip needed for data already on the page.
export function InsightsExport({ data }: { data: InsightsExportData }) {
  function exportCsv() {
    const lines: string[] = [];
    lines.push(`Insights export — ${data.rangeLabel}`);
    lines.push("");
    lines.push("Summary");
    for (const k of data.kpis) lines.push([esc(k.label), esc(k.val)].join(","));
    lines.push("");
    lines.push("Revenue by week");
    lines.push(["Week", "Revenue"].join(","));
    for (const w of data.weeks) lines.push([esc(w.label), String(w.total)].join(","));
    lines.push("");
    lines.push("By driver");
    lines.push(["Driver", "Loads", "Revenue"].join(","));
    for (const d of data.drivers) lines.push([esc(d.name), String(d.loads), String(d.revenue)].join(","));

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insights-${data.rangeLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
      Export CSV
    </button>
  );
}
