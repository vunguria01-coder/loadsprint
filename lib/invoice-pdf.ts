// Server-side invoice renderer. Built with pdf-lib (already used for the rate
// confirmation copy and the driver rate sheet), so an invoice never depends on
// a browser or on a CDN-hosted PDF library.
//
// The layout follows the carrier invoice the owner works with: logo + company
// details up top, Bill To / Ship To on the left, invoice meta on the right, one
// table of line items, and the Subtotal → TAX → Shipping → Total → PAID →
// Balance Due block at the bottom right.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { invoiceTotals, usDate, type InvoiceDoc } from "@/lib/invoice-build";

const W = 612; // US Letter
const H = 792;
const M = 48;

const BLUE = rgb(0.23, 0.51, 0.85);
const BLUE_SOFT = rgb(0.93, 0.95, 0.99);
const DARK = rgb(0.26, 0.28, 0.31);
const TEXT = rgb(0.32, 0.34, 0.37);
const LABEL = rgb(0.24, 0.26, 0.29);
const RULE = rgb(0.85, 0.87, 0.9);

// Column edges for the line-item table.
const COL_QTY = 380;
const COL_RATE = 476;
const COL_AMOUNT = W - M;
const DESC_W = COL_QTY - M - 80;

const money = (n: number) =>
  "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The standard PDF fonts are WinAnsi-encoded: anything outside Latin-1 (Cyrillic,
// CJK, emoji) makes pdf-lib throw. Swap the common typographic characters for
// their ASCII twins and drop the rest so a stray character can never break an
// invoice mid-render.
function wa(text: string): string {
  return String(text ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(wa(text), size);
}

// Greedy word wrap; long unbroken tokens are hard-split so nothing runs past the
// column edge.
function wrap(font: PDFFont, text: string, size: number, max: number): string[] {
  const out: string[] = [];
  for (const paragraph of String(text ?? "").split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(font, candidate, size) <= max) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      if (widthOf(font, word, size) <= max) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        if (widthOf(font, chunk + ch, size) > max) {
          out.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    if (line) out.push(line);
  }
  return out;
}

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
};

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {}
) {
  const size = opts.size ?? 9;
  const font = opts.bold ? ctx.bold : ctx.font;
  const body = wa(s);
  if (!body) return;
  const w = font.widthOfTextAtSize(body, size);
  const px = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
  ctx.page.drawText(body, { x: px, y, size, font, color: opts.color ?? TEXT });
}

async function embedLogo(pdf: PDFDocument, dataUrl: string) {
  const match = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(dataUrl || "");
  if (!match) return undefined; // other formats are skipped rather than failing the invoice
  try {
    const bytes = Buffer.from(match[2], "base64");
    return match[1].toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return undefined;
  }
}

export async function generateInvoicePdf(inv: InvoiceDoc): Promise<string> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = inv.company.logoDataUrl ? await embedLogo(pdf, inv.company.logoDataUrl) : undefined;

  const newPage = (): Ctx => ({ page: pdf.addPage([W, H]), font, bold });
  let ctx = newPage();

  /* ---------- header: logo left, company details right ---------- */

  let y = H - 44;
  if (logo) {
    const box = 58;
    const scale = Math.min(box / logo.width, box / logo.height);
    ctx.page.drawImage(logo, {
      x: M,
      y: y - logo.height * scale,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  }

  const detailLines = [
    ...wrap(font, inv.company.address, 8.5, 220),
    inv.company.email,
    inv.company.phone,
    inv.company.taxId ? `Tax Registration #: ${inv.company.taxId}` : "",
  ].filter(Boolean);
  let dy = y - 4;
  for (const line of detailLines.slice(0, 7)) {
    text(ctx, line, W - M, dy, { size: 8.5, align: "right", color: TEXT });
    dy -= 11.5;
  }

  /* ---------- company name + "Invoice" ---------- */

  y = Math.min(y - 78, dy - 26);
  text(ctx, inv.company.name || "Invoice", M, y, { size: 26, bold: true, color: DARK });
  text(ctx, "Invoice", W - M, y + 2, { size: 20, bold: true, align: "right", color: BLUE });
  y -= 34;

  /* ---------- Bill To / Ship To (left) + meta grid (right) ---------- */

  const VALUE_X = M + 112; // left column values line up under one another
  const META_LABEL_X = W - M - 116;

  const partyBlock = (title: string, value: string, top: number): number => {
    text(ctx, title, M, top, { size: 8.5, bold: true, color: LABEL });
    let yy = top;
    for (const line of wrap(font, value, 9, 210).slice(0, 5)) {
      text(ctx, line, VALUE_X, yy, { size: 9, color: TEXT });
      yy -= 12;
    }
    return Math.min(top, yy) - 4;
  };

  const metaRow = (label: string, value: string, top: number) => {
    text(ctx, label, META_LABEL_X, top, { size: 8.5, bold: true, align: "right", color: LABEL });
    text(ctx, value, W - M, top, { size: 9, align: "right", color: TEXT });
  };

  const metaTop = y;
  metaRow("Invoice No:", inv.invoiceNumber, metaTop);
  metaRow("Date:", usDate(inv.date), metaTop - 14);
  metaRow("Terms:", inv.terms, metaTop - 28);
  metaRow("Due Date:", usDate(inv.dueDate), metaTop - 42);

  const afterBillTo = partyBlock("Bill To:", inv.billTo || "-", y);
  y = Math.min(afterBillTo, metaTop - 42) - 20;

  const shipTop = y;
  metaRow("Tracking No", inv.trackingNo, shipTop);
  metaRow("Ship Via", inv.shipVia, shipTop - 14);
  metaRow("FOB", inv.fob, shipTop - 28);
  const afterShipTo = partyBlock("Ship To:", inv.shipTo, shipTop);
  y = Math.min(afterShipTo, shipTop - 28) - 22;

  /* ---------- line items ---------- */

  ctx.page.drawRectangle({ x: 0, y, width: W, height: 2, color: BLUE });
  y -= 24;
  ctx.page.drawRectangle({ x: 0, y: y - 8, width: W, height: 26, color: BLUE_SOFT });
  text(ctx, "Description", M, y, { size: 8.5, bold: true, color: LABEL });
  text(ctx, "Quantity", COL_QTY, y, { size: 8.5, bold: true, align: "right", color: LABEL });
  text(ctx, "Rate", COL_RATE, y, { size: 8.5, bold: true, align: "right", color: LABEL });
  text(ctx, "Amount", COL_AMOUNT, y, { size: 8.5, bold: true, align: "right", color: LABEL });
  y -= 30;

  for (const item of inv.items) {
    const lines = wrap(font, item.description, 9, DESC_W);
    const needed = Math.max(lines.length, 1) * 13 + 10;
    if (y - needed < 150) {
      // Long stop lists spill onto a second page; totals stay with the last rows.
      ctx = newPage();
      y = H - 60;
    }
    const rowTop = y;
    for (const line of lines) {
      text(ctx, line, M, y, { size: 9, color: TEXT });
      y -= 13;
    }
    if (lines.length === 0) y -= 13;
    text(ctx, String(item.quantity), COL_QTY, rowTop, { size: 9, align: "right", color: TEXT });
    text(ctx, money(item.rate), COL_RATE, rowTop, { size: 9, align: "right", color: TEXT });
    text(ctx, money((Number(item.quantity) || 0) * (Number(item.rate) || 0)), COL_AMOUNT, rowTop, {
      size: 9,
      align: "right",
      color: TEXT,
    });
    y -= 10;
    ctx.page.drawLine({
      start: { x: M, y: y + 4 },
      end: { x: W - M, y: y + 4 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 8;
  }

  /* ---------- totals ---------- */

  const t = invoiceTotals(inv);
  if (y < 210) {
    ctx = newPage();
    y = H - 80;
  }
  y -= 22;

  const totalRow = (label: string, value: string) => {
    text(ctx, label, COL_RATE, y, { size: 9, align: "right", color: TEXT });
    text(ctx, value, COL_AMOUNT, y, { size: 9, align: "right", color: TEXT });
    y -= 15;
  };
  totalRow("Subtotal", money(t.subtotal));
  totalRow(`TAX ${inv.taxPercent}%`, money(t.tax));
  totalRow("Shipping", money(inv.shipping));
  totalRow("Total", money(t.total));

  y -= 6;
  ctx.page.drawLine({
    start: { x: W / 2 - 12, y },
    end: { x: W - M, y },
    thickness: 1.5,
    color: BLUE,
  });
  y -= 18;
  totalRow("PAID", money(inv.paid));

  y -= 4;
  ctx.page.drawLine({
    start: { x: W / 2 - 12, y },
    end: { x: W - M, y },
    thickness: 2,
    color: BLUE,
  });
  y -= 24;
  text(ctx, "Balance Due", COL_RATE, y, { size: 16, align: "right", color: DARK });
  text(ctx, money(t.balanceDue), COL_AMOUNT, y, { size: 16, align: "right", color: DARK });
  y -= 10;
  ctx.page.drawLine({
    start: { x: W / 2 - 12, y },
    end: { x: W - M, y },
    thickness: 2,
    color: BLUE,
  });

  /* ---------- footer note + page numbers ---------- */

  if (inv.company.notes) {
    const note = wrap(font, inv.company.notes, 8.5, W - 2 * M).slice(0, 3);
    let ny = 64 + note.length * 11;
    for (const line of note) {
      text(ctx, line, M, ny, { size: 8.5, color: TEXT });
      ny -= 11;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = wa(`${i + 1} / ${pages.length}`);
    p.drawText(label, {
      x: W / 2 - font.widthOfTextAtSize(label, 8.5) / 2,
      y: 34,
      size: 8.5,
      font,
      color: TEXT,
    });
  });

  const bytes = await pdf.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}
