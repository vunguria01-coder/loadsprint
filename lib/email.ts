// Email sending via Resend's REST API (no SDK dependency — just fetch).
// Configure on the server: RESEND_API_KEY (required) and optionally EMAIL_FROM.
// If RESEND_API_KEY is not set, email is silently skipped so the app keeps
// working — invites still generate a code/link the dispatcher can share.

const FROM = process.env.EMAIL_FROM || "LoadSprint <onboarding@resend.dev>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  // Prefer SMTP (e.g. Google Workspace) when configured — sending through a
  // Google mailbox gives Gmail-trusted deliverability that a brand-new domain
  // on a shared ESP can't match. Falls back to Resend when SMTP isn't set.
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(process.env.SMTP_PORT || 465);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        ...(opts.html ? { html: opts.html } : {}),
        ...(opts.text ? { text: opts.text } : {}),
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "smtp send failed";
      console.error(`[email] SMTP send to ${opts.to} failed: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        // A plain-text-only message (no html) reads as a personal note rather
        // than a marketing blast — often better for spam filters.
        ...(opts.html ? { html: opts.html } : {}),
        ...(opts.text ? { text: opts.text } : {}),
      }),
      // Don't let a slow Resend response hang the sign-in / invite request.
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      // Surface the failure in server logs so delivery problems are diagnosable
      // (e.g. unverified sending domain, invalid key) instead of failing silently.
      console.error(`[email] Resend rejected send to ${opts.to} from "${FROM}": HTTP ${res.status} ${t}`);
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    console.error(`[email] send to ${opts.to} failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

// Driver invitation email: join code + App Store download. Links only to the
// Apple App Store (a trusted domain) — not a second brand domain — which keeps
// the message off Gmail's phishing/"unsolicited" heuristics.
export function driverInviteEmail(opts: {
  dispatcherName: string;
  code: string;
  appStoreUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `${opts.dispatcherName} invited you to drive with LoadSprint`;
  const html = `<!doctype html><html><body style="margin:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#e8eef8">
      <h1 style="font-size:22px;margin:0 0 6px;color:#fff">You've been invited to LoadSprint</h1>
      <p style="color:#93a4be;font-size:14px;line-height:1.6;margin:0 0 22px">
        ${escapeHtml(opts.dispatcherName)} added you as a driver. Install the
        LoadSprint Driver app, then enter the join code below to sign in and start
        receiving loads.
      </p>
      <div style="background:#111c30;border:1px solid #22304a;border-radius:14px;padding:20px;text-align:center;margin-bottom:22px">
        <div style="font-size:11px;color:#93a4be;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Your join code</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:4px;color:#38bdf8">${escapeHtml(opts.code)}</div>
      </div>
      <a href="${escapeAttr(opts.appStoreUrl)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px;font-size:15px;border:1px solid #333"> Download on the App Store</a>
      <p style="color:#6b7a93;font-size:12px;line-height:1.6;margin:24px 0 0">
        After installing, open the LoadSprint Driver app and enter the code above.
        Didn't expect this email? You can safely ignore it.
      </p>
    </div>
  </body></html>`;
  const text =
    `Hi,\n\n` +
    `${opts.dispatcherName} added you as a driver on LoadSprint.\n\n` +
    `Your join code:\n` +
    `${opts.code}\n\n` +
    `Get the LoadSprint Driver app:\n` +
    `${opts.appStoreUrl}\n\n` +
    `Open the app and enter your code to start receiving loads.\n\n` +
    `Didn't expect this email? You can ignore it.`;
  return { subject, html, text };
}

// Invite email for an additional dispatcher seat (registers on the website).
export function dispatcherInviteEmail(opts: {
  ownerName: string;
  code: string;
  joinLink: string;
}): { subject: string; html: string; text: string } {
  const subject = `You're invited to dispatch on LoadSprint — code ${opts.code}`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#0b1120">
      <h1 style="font-size:22px;margin:0 0 6px;color:#0b1120">You've been added as a dispatcher</h1>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 22px">
        ${escapeHtml(opts.ownerName)} invited you to help dispatch on their LoadSprint
        account. Use the code below to create your dispatcher login on the website.
      </p>
      <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center;margin-bottom:22px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Your invite code</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:4px;color:#2563eb">${escapeHtml(opts.code)}</div>
      </div>
      <a href="${escapeAttr(opts.joinLink)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;font-size:15px">Create my dispatcher account</a>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0">
        If the button doesn't work, go to ${escapeHtml(opts.joinLink)} and enter the code above.
        Didn't expect this email? You can safely ignore it.
      </p>
    </div>
  </body></html>`;
  const text = `You've been added as a dispatcher on LoadSprint by ${opts.ownerName}.
Your invite code: ${opts.code}
Create your dispatcher account: ${opts.joinLink}`;
  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// Two-factor verification code email.
export function twoFactorEmail(code: string): { subject: string; html: string; text: string } {
  const subject = "Confirm your LoadSprint sign-in";
  const text =
    `Hello,\n\n` +
    `You're confirming a sign-in to your LoadSprint account. ` +
    `Please type the following confirmation number on the sign-in screen:\n\n` +
    `${code}\n\n` +
    `This number is valid for 10 minutes. If this wasn't you, no action is needed — ` +
    `you can ignore this message and your account stays as it is.\n\n` +
    `LoadSprint dispatch software`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e9f2;border-radius:12px">
          <tr><td style="padding:28px 28px 8px">
            <div style="font-size:18px;font-weight:bold;color:#111827">LoadSprint</div>
          </td></tr>
          <tr><td style="padding:0 28px">
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:8px 0 0">Hello,</p>
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:12px 0 0">
              You're confirming a sign-in to your LoadSprint account. Please type the
              confirmation number below on the sign-in screen. It stays valid for 10 minutes.
            </p>
          </td></tr>
          <tr><td style="padding:18px 28px">
            <div style="background:#f3f6fc;border:1px solid #dde4f1;border-radius:8px;padding:16px;text-align:center;font-size:24px;font-weight:bold;color:#1f2937;letter-spacing:3px">${escapeHtml(code)}</div>
          </td></tr>
          <tr><td style="padding:0 28px 8px">
            <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0">
              If this wasn't you, no action is needed — you can ignore this message and your account stays as it is.
            </p>
          </td></tr>
          <tr><td style="padding:14px 28px 26px">
            <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0">LoadSprint dispatch software</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
  return { subject, html, text };
}
// Password-reset code email.
export function passwordResetEmail(code: string): { subject: string; html: string; text: string } {
  const subject = "Reset your LoadSprint password";
  const text =
    `Hello,\n\n` +
    `We received a request to reset the password on your LoadSprint account. ` +
    `Type the confirmation number below on the password-reset screen:\n\n` +
    `${code}\n\n` +
    `This number is valid for 10 minutes. If you didn't request this, you can ` +
    `safely ignore this message — your password stays unchanged.\n\n` +
    `LoadSprint dispatch software`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e9f2;border-radius:12px">
          <tr><td style="padding:28px 28px 8px">
            <div style="font-size:18px;font-weight:bold;color:#111827">LoadSprint</div>
          </td></tr>
          <tr><td style="padding:0 28px">
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:8px 0 0">Hello,</p>
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:12px 0 0">
              We received a request to reset your LoadSprint password. Type the
              confirmation number below on the password-reset screen. It stays valid for 10 minutes.
            </p>
          </td></tr>
          <tr><td style="padding:18px 28px">
            <div style="background:#f3f6fc;border:1px solid #dde4f1;border-radius:8px;padding:16px;text-align:center;font-size:24px;font-weight:bold;color:#1f2937;letter-spacing:3px">${escapeHtml(code)}</div>
          </td></tr>
          <tr><td style="padding:0 28px 8px">
            <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0">
              If you didn't request this, you can safely ignore this message — your password stays unchanged.
            </p>
          </td></tr>
          <tr><td style="padding:14px 28px 26px">
            <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0">LoadSprint dispatch software</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
  return { subject, html, text };
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "%22");
}
