const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'Chart Replay <noreply@chartreplay.co.za>';
const DEFAULT_REPLY_TO = 'info@chartreplay.co.za';
const DEFAULT_APP_URL = 'https://chartreplay.co.za';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveResendConfig(env = process.env) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  if (!apiKey || env.RESEND_ENABLED === 'false') return null;
  const fromEmail = String(env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim() || DEFAULT_FROM_EMAIL;
  const replyTo = String(env.RESEND_REPLY_TO || DEFAULT_REPLY_TO).trim() || DEFAULT_REPLY_TO;
  const appUrl = String(env.PUBLIC_APP_URL || env.APP_URL || DEFAULT_APP_URL)
    .trim()
    .replace(/\/+$/, '');
  return { apiKey, fromEmail, replyTo, appUrl };
}

export function isResendConfigured(env = process.env) {
  return Boolean(resolveResendConfig(env));
}

export function resolvePublicAppUrl(originHeader, env = process.env) {
  if (typeof originHeader === 'string' && originHeader.trim()) {
    try {
      const parsed = new URL(originHeader.trim());
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // fall through
    }
  }
  const cfg = resolveResendConfig(env);
  return cfg?.appUrl || DEFAULT_APP_URL;
}

export async function sendResendEmail(
  { to, subject, html, text },
  { env = process.env, request = fetch } = {}
) {
  const cfg = resolveResendConfig(env);
  if (!cfg) {
    return { sent: false, reason: 'RESEND_NOT_CONFIGURED' };
  }
  const recipients = (Array.isArray(to) ? to : [to])
    .map((addr) => String(addr || '').trim().toLowerCase())
    .filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false, reason: 'NO_RECIPIENT' };
  }

  try {
    const response = await request(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.fromEmail,
        to: recipients,
        reply_to: cfg.replyTo,
        subject: String(subject || '').trim(),
        html: String(html || ''),
        text: String(text || ''),
      }),
      signal: AbortSignal.timeout(10000),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        sent: false,
        status: response.status,
        error:
          (data && typeof data === 'object' && (data.message || data.error)) ||
          `Resend HTTP ${response.status}`,
      };
    }

    return {
      sent: true,
      id: data && typeof data === 'object' ? data.id || null : null,
    };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildWelcomeEmail({ name, email, appUrl = DEFAULT_APP_URL }) {
  const cleanName = escapeHtml(String(name || 'Trader').trim() || 'Trader');
  const safeAppUrl = escapeHtml(String(appUrl || DEFAULT_APP_URL).replace(/\/+$/, ''));
  const subject = 'Welcome to Chart Replay — Your trading workspace is ready';

  const text = [
    `Hi ${String(name || 'Trader').trim() || 'Trader'},`,
    '',
    'Welcome to Chart Replay! Your free account has been created and your trading workspace is ready.',
    '',
    'What you can do right away:',
    '• Replay historical charts on Gold (XAU/USD), NAS100, EUR/USD, and more',
    '• Test 1-Step and 2-Step Prop Firm Challenge rules with zero financial risk',
    '• Document your Trading Plan, strategies, and trade journal notes in one place',
    '',
    `Open your workspace: ${String(appUrl || DEFAULT_APP_URL).replace(/\/+$/, '')}`,
    '',
    `Signed-up account: ${String(email || '').trim().toLowerCase()}`,
    '',
    'Built in South Africa for deliberate trader development. Simulated money only.',
    'Need help? Reply to this email or contact info@chartreplay.co.za.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#06080d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#06080d;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#0c121e;border:1px solid #1e293b;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px 32px;background:linear-gradient(135deg,#0f1f2e 0%,#0c121e 100%);border-bottom:1px solid #1e293b;">
              <div style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                Chart Replay · Free Forever
              </div>
              <h1 style="margin:16px 0 6px 0;font-size:24px;line-height:1.25;font-weight:800;color:#ffffff;">
                Welcome aboard, ${cleanName}!
              </h1>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#94a3b8;">
                Your trading simulator account is active and ready for deliberate practice.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.65;color:#cbd5e1;">
                We built Chart Replay so traders can test their edge, refine execution, and master prop-firm rules without risking real capital.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;background-color:#090e17;border:1px solid #1e293b;border-radius:14px;padding:18px 20px;">
                <tr>
                  <td style="font-size:13px;line-height:1.7;color:#cbd5e1;">
                    <strong style="color:#34d399;">✓ Historical Chart Replay</strong> — Bar-by-bar playback across XAU/USD, NAS100, FX &amp; crypto.<br/>
                    <strong style="color:#38bdf8;">✓ Prop Firm Simulator</strong> — Practice FTMO &amp; custom daily/overall drawdown rules.<br/>
                    <strong style="color:#a78bfa;">✓ Strategy &amp; Trade Journal</strong> — Keep your trading plan, checklists, and trade reviews synced.
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(90deg,#10b981,#2962ff);">
                    <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Open Your Trading Workspace →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                Registered email: <span style="color:#94a3b8;">${escapeHtml(String(email || '').trim().toLowerCase())}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#080c14;border-top:1px solid #1e293b;font-size:11px;line-height:1.6;color:#64748b;">
              Built in South Africa · Technology for trader development · Simulated money only.<br/>
              Questions? Contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function buildPasswordResetEmail({ name, email, resetUrl, expiresMinutes = 30 }) {
  const cleanName = escapeHtml(String(name || 'Trader').trim() || 'Trader');
  const safeResetUrl = escapeHtml(String(resetUrl || ''));
  const subject = 'Reset your Chart Replay password';

  const text = [
    `Hi ${String(name || 'Trader').trim() || 'Trader'},`,
    '',
    'We received a request to reset the password for your Chart Replay account.',
    '',
    'Click the link below to choose a new password:',
    String(resetUrl || ''),
    '',
    `This secure link expires in ${expiresMinutes} minutes and can only be used once.`,
    '',
    'If you did not request a password reset, you can safely ignore this email—your password will remain unchanged.',
    '',
    'Chart Replay · info@chartreplay.co.za',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#06080d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#06080d;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#0c121e;border:1px solid #1e293b;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px 32px;background:linear-gradient(135deg,#0f1f2e 0%,#0c121e 100%);border-bottom:1px solid #1e293b;">
              <div style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                Account Security
              </div>
              <h1 style="margin:16px 0 6px 0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">
                Reset your password
              </h1>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#94a3b8;">
                Hi ${cleanName}, use the secure link below to set a new password for your Chart Replay account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(90deg,#10b981,#2962ff);">
                    <a href="${safeResetUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Choose a New Password →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 14px 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                This link expires in <strong style="color:#e2e8f0;">${Number(expiresMinutes)} minutes</strong>. Once you set a new password, this link is automatically invalidated.
              </p>
              <p style="margin:0 0 18px 0;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">
                If the button above doesn’t open, copy and paste this link into your browser:<br/>
                <a href="${safeResetUrl}" style="color:#38bdf8;text-decoration:underline;">${safeResetUrl}</a>
              </p>
              <div style="padding:14px 16px;background-color:#090e17;border:1px solid #1e293b;border-radius:12px;font-size:12px;line-height:1.5;color:#94a3b8;">
                Didn’t request this change? You can safely ignore this email. Your password for <strong>${escapeHtml(String(email || '').trim().toLowerCase())}</strong> will not be changed.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#080c14;border-top:1px solid #1e293b;font-size:11px;line-height:1.6;color:#64748b;">
              Built in South Africa · Chart Replay · Simulated money only.<br/>
              Need assistance? Contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export async function sendWelcomeEmail(
  { name, email, origin },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const content = buildWelcomeEmail({ name, email, appUrl });
  return sendResendEmail(
    {
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    },
    { env, request }
  );
}

export async function sendPasswordResetEmail(
  { name, email, resetToken, origin, expiresMinutes = 30 },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const resetUrl = `${appUrl}/?reset_token=${encodeURIComponent(
    resetToken
  )}&email=${encodeURIComponent(String(email || '').trim().toLowerCase())}`;
  const content = buildPasswordResetEmail({
    name,
    email,
    resetUrl,
    expiresMinutes,
  });
  return sendResendEmail(
    {
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    },
    { env, request }
  );
}
