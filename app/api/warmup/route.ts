import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

// Deliverability warm-up. A scheduled cron hits this daily; it sends a small,
// human-looking message to YOUR OWN inboxes (WARMUP_TO). You open each one and
// mark "Not spam" / reply — that engagement is what actually builds the domain's
// sender reputation over a couple of weeks. Sending alone does nothing; the
// opens/replies are the point. Protected by WARMUP_SECRET so only your cron can
// trigger it, and it only ever mails the addresses you configured.

const VARIANTS = [
  {
    subject: "LoadSprint — quick check-in",
    body:
      "Hi,\n\nJust a quick check-in from LoadSprint to make sure everything's " +
      "running smoothly on your end. If you have a second, hit reply and let me " +
      "know it arrived.\n\nThanks,\nLoadSprint",
  },
  {
    subject: "Anything you need from LoadSprint?",
    body:
      "Hey,\n\nHope your week's going well. If there's anything you'd like us to " +
      "add or fix in LoadSprint, just reply to this note and we'll take a look.\n\n" +
      "Talk soon,\nLoadSprint",
  },
  {
    subject: "LoadSprint update",
    body:
      "Hello,\n\nThings are moving along at LoadSprint. No action needed on your " +
      "side — reply if you'd like to chat, otherwise we'll keep you posted.\n\n" +
      "Best,\nLoadSprint",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const secret = process.env.WARMUP_SECRET;
  if (!secret || key !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const list = (process.env.WARMUP_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Set WARMUP_TO to a comma-separated list of your own inbox addresses." },
      { status: 400 }
    );
  }

  // Rotate content so repeated sends aren't byte-identical (spam filters dislike that).
  const v = VARIANTS[new Date().getUTCDate() % VARIANTS.length];

  const results: Array<{ to: string; ok: boolean; error?: string; skipped?: boolean }> = [];
  for (const to of list) {
    const r = await sendEmail({ to, subject: v.subject, text: v.body });
    results.push({ to, ok: r.ok, error: r.error, skipped: r.skipped });
  }

  return NextResponse.json({ ok: true, sent: results.length, results });
}
