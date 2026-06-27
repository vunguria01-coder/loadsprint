// Email sending via Resend's REST API (no SDK dependency — just fetch).
// Configure on the server: RESEND_API_KEY (required) and optionally EMAIL_FROM.
// If RESEND_API_KEY is not set, email is silently skipped so the app keeps
// working — invites still generate a code/link the dispatcher can share.

const FROM = process.env.EMAIL_FROM || "LoadSprint <onboarding@resend.dev>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
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
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

// Driver invitation email: join code + app link.
export function driverInviteEmail(opts: {
  dispatcherName: string;
  code: string;
  appLink: string;
}): { subject: string; html: string } {
  const subject = `You're invited to LoadSprint — your join code is ${opts.code}`;
  const html = `<!doctype html><html><body style="margin:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#e8eef8">
      <h1 style="font-size:22px;margin:0 0 6px;color:#fff">You've been invited to LoadSprint</h1>
      <p style="color:#93a4be;font-size:14px;line-height:1.6;margin:0 0 22px">
        ${escapeHtml(opts.dispatcherName)} added you as a driver. Use the join code
        below to sign in to the LoadSprint driver app and start receiving loads.
      </p>
      <div style="background:#111c30;border:1px solid #22304a;border-radius:14px;padding:20px;text-align:center;margin-bottom:22px">
        <div style="font-size:11px;color:#93a4be;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Your join code</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:4px;color:#38bdf8">${escapeHtml(opts.code)}</div>
      </div>
      <a href="${escapeAttr(opts.appLink)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;font-size:15px">Open the driver app</a>
      <p style="color:#6b7a93;font-size:12px;line-height:1.6;margin:24px 0 0">
        If the button doesn't work, open the LoadSprint driver app and enter the
        code above. Didn't expect this email? You can safely ignore it.
      </p>
    </div>
  </body></html>`;
  return { subject, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// Two-factor verification code email.
export function twoFactorEmail(code: string): { subject: string; html: string } {
  const subject = "Your LoadSprint verification code";
  const html = `<!doctype html><html><body style="margin:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;color:#e7eefc">
      <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:6px">LoadSprint</div>
      <p style="color:#93a4be;font-size:14px;line-height:1.6;margin:0 0 18px">
        Use this code to finish signing in. It expires in 10 minutes.
      </p>
      <div style="background:#111a2e;border:1px solid #22304a;border-radius:12px;padding:18px;text-align:center;margin-bottom:18px">
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#38bdf8">${escapeHtml(code)}</div>
      </div>
      <p style="color:#6b7a93;font-size:12px;line-height:1.6;margin:0">
        If you didn't try to sign in, you can safely ignore this email and your account stays secure.
      </p>
    </div>
  </body></html>`;
  return { subject, html };
}
function escapeAttr(s: string) {
  return s.replace(/"/g, "%22");
}
