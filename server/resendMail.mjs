const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'Cheslin from Chart Replay <noreply@chartreplay.co.za>';
const DEFAULT_REPLY_TO = 'info@voomay.co.za';
const DEFAULT_APP_URL = 'https://chartreplay.co.za';
const WELCOME_BANNER_URL = 'https://chartreplay.co.za/email-welcome-banner.png';
export const CONTACT_INQUIRY_RECIPIENT = 'info@voomay.co.za';
export const PERSONAL_CONTACT_EMAIL = 'cheslin@voomay.co.za';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeOfficialAppUrl(rawUrl) {
  const cleaned = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!cleaned) return DEFAULT_APP_URL;
  try {
    const parsed = new URL(cleaned);
    if (
      parsed.hostname.endsWith('.vercel.app') ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    ) {
      return DEFAULT_APP_URL;
    }
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    // fall through
  }
  return DEFAULT_APP_URL;
}

export function resolveResendConfig(env = process.env) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  if (!apiKey || env.RESEND_ENABLED === 'false') return null;
  const fromEmail = String(env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim() || DEFAULT_FROM_EMAIL;
  const replyTo = String(env.RESEND_REPLY_TO || DEFAULT_REPLY_TO).trim() || DEFAULT_REPLY_TO;
  const appUrl = sanitizeOfficialAppUrl(env.PUBLIC_APP_URL || env.APP_URL || DEFAULT_APP_URL);
  return { apiKey, fromEmail, replyTo, appUrl };
}

export function isResendConfigured(env = process.env) {
  return Boolean(resolveResendConfig(env));
}

export function resolvePublicAppUrl(_originHeader, env = process.env) {
  const cfg = resolveResendConfig(env);
  return sanitizeOfficialAppUrl(cfg?.appUrl || env.PUBLIC_APP_URL || env.APP_URL || DEFAULT_APP_URL);
}

export function buildUnsubscribeUrl(email, appUrl = DEFAULT_APP_URL) {
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return `${officialUrl}/?unsubscribe=1`;
  return `${officialUrl}/?unsubscribe=1&email=${encodeURIComponent(cleanEmail)}`;
}

export async function sendResendEmail(
  { to, subject, html, text, replyTo, unsubscribeUrl },
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

  const effectiveReplyTo =
    (typeof replyTo === 'string' && replyTo.trim()) || cfg.replyTo;
  const cleanUnsubUrl =
    typeof unsubscribeUrl === 'string' && unsubscribeUrl.trim()
      ? unsubscribeUrl.trim()
      : '';

  try {
    const payload = {
      from: cfg.fromEmail,
      to: recipients,
      reply_to: effectiveReplyTo,
      subject: String(subject || '').trim(),
      html: String(html || ''),
      text: String(text || ''),
      ...(cleanUnsubUrl
        ? {
            headers: {
              'List-Unsubscribe': `<${cleanUnsubUrl}>, <mailto:${effectiveReplyTo}?subject=Unsubscribe>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    };
    const response = await request(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

export function buildWelcomeEmail({ name, email, appUrl = DEFAULT_APP_URL, unsubscribeUrl }) {
  const cleanName = escapeHtml(String(name || 'Trader').trim() || 'Trader');
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const safeAppUrl = escapeHtml(officialUrl);
  const cleanEmailRaw = String(email || '').trim().toLowerCase();
  const safeEmail = escapeHtml(cleanEmailRaw);
  const targetUnsubscribeUrl =
    String(unsubscribeUrl || '').trim() || buildUnsubscribeUrl(cleanEmailRaw, officialUrl);
  const safeUnsubscribeUrl = escapeHtml(targetUnsubscribeUrl);
  const subject = 'Welcome to Chart Replay — Your Trading Practice Starts Here';

  const text = [
    `Hi ${String(name || 'Trader').trim() || 'Trader'},`,
    '',
    'Welcome aboard! Your free Chart Replay account is active and your trading workspace is ready.',
    '',
    '5 Benefits of Practicing on Chart Replay:',
    '1. Bar-by-Bar Historical Chart Replay — Practice on real historical price action across Gold (XAU/USD), NAS100, Forex majors, and Crypto at your own pace.',
    '2. Prop Firm Challenge Simulator — Test 1-Step, 2-Step, and custom prop firm evaluation rules with live daily and maximum drawdown tracking.',
    '3. 100% Free & Zero Financial Risk — Build screen time and validate your setups with simulated capital (USD or ZAR) before risking real money.',
    '4. On-Chart Sticky Trading Plan & Playbooks — Pin a concise sticky-note version of your trading plan right on the chart and journal every trade.',
    '5. Deep Performance Analytics & Psychology Coach — Track win rate, profit factor, R-multiples, and stay disciplined with Michael, your AI psychology coach.',
    '',
    `Open Your Trading Workspace: ${officialUrl}`,
    '',
    `Registered email: ${cleanEmailRaw}`,
    '',
    'Chart Replay · https://chartreplay.co.za · Simulated money only.',
    'Questions or feedback? Contact info@chartreplay.co.za.',
    `Unsubscribe from emails: ${targetUnsubscribeUrl}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#050811;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050811;padding:36px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#0b111e;border:1px solid #1e293b;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.65);">
          <!-- Hero Banner Image -->
          <tr>
            <td style="padding:0;background-color:#080d18;border-bottom:1px solid #1e293b;">
              <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
                <img src="${WELCOME_BANNER_URL}" alt="Welcome to Chart Replay — Replay. Practice. Perfect Your Edge." width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Greeting & Intro -->
          <tr>
            <td style="padding:32px 34px 20px 34px;background:linear-gradient(180deg,#0f1829 0%,#0b111e 100%);">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background-color:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                Account Active · Free Forever
              </div>
              <h1 style="margin:16px 0 10px 0;font-size:26px;line-height:1.25;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                Welcome aboard, ${cleanName}!
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#cbd5e1;">
                Your trading workspace on <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:none;font-weight:600;">chartreplay.co.za</a> is ready. Create your first session, pin your trading plan to the chart, and sharpen your execution with zero financial risk.
              </p>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding:4px 34px 28px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius:14px;background:linear-gradient(90deg,#10b981 0%,#0ea5e9 55%,#2563eb 100%);box-shadow:0 10px 25px rgba(16,185,129,0.25);">
                    <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:14px;">
                      Open Your Trading Workspace →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 5 Platform Benefits -->
          <tr>
            <td style="padding:0 34px 28px 34px;">
              <div style="margin:0 0 14px 0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#38bdf8;">
                5 Benefits of Practicing on Chart Replay
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080d17;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
                <!-- Benefit 1 -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #162032;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background-color:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:13px;font-weight:800;">1</div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:3px;">Bar-by-Bar Historical Chart Replay</div>
                          <div style="font-size:13px;line-height:1.55;color:#94a3b8;">Step through real historical price action on Gold (XAU/USD), NAS100, Forex majors, and Crypto at your own speed.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Benefit 2 -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #162032;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background-color:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.35);color:#38bdf8;font-size:13px;font-weight:800;">2</div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:3px;">Prop Firm Challenge Simulator</div>
                          <div style="font-size:13px;line-height:1.55;color:#94a3b8;">Practice 1-Step, 2-Step, and custom prop firm evaluation rules with live daily and maximum drawdown tracking.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Benefit 3 -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #162032;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background-color:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.35);color:#a78bfa;font-size:13px;font-weight:800;">3</div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:3px;">100% Free &amp; Zero Financial Risk</div>
                          <div style="font-size:13px;line-height:1.55;color:#94a3b8;">Build months of market screen time in hours using simulated capital in USD ($) or ZAR (R) before risking real money.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Benefit 4 -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #162032;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background-color:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.35);color:#fbbf24;font-size:13px;font-weight:800;">4</div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:3px;">On-Chart Sticky Trading Plan &amp; Trade Journal</div>
                          <div style="font-size:13px;line-height:1.55;color:#94a3b8;">Keep a short sticky-note version of your trading plan pinned directly on your chart and log every setup with notes.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Benefit 5 -->
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background-color:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.35);color:#fb7185;font-size:13px;font-weight:800;">5</div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:3px;">Deep Analytics &amp; Psychology Coach</div>
                          <div style="font-size:13px;line-height:1.55;color:#94a3b8;">Review your win rate, profit factor, equity curve, and R-multiples while getting real-time discipline check-ins.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick Start Tip Box -->
          <tr>
            <td style="padding:0 34px 28px 34px;">
              <div style="padding:16px 18px;background:linear-gradient(135deg,rgba(16,185,129,0.08) 0%,rgba(56,189,248,0.06) 100%);border:1px solid rgba(56,189,248,0.25);border-radius:14px;font-size:13px;line-height:1.6;color:#cbd5e1;">
                <strong style="color:#34d399;">Ready to start?</strong> Click <strong>New Session</strong> in your dashboard to configure your first Backtesting or Prop Firm Challenge session, then click <strong>My Plan</strong> on the chart to write your sticky-note trading rules.
              </div>
              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                Registered account: <span style="color:#94a3b8;font-weight:600;">${safeEmail}</span> · Website: <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:none;">chartreplay.co.za</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 34px;background-color:#070b14;border-top:1px solid #1e293b;font-size:11px;line-height:1.7;color:#64748b;text-align:center;">
              <strong style="color:#94a3b8;">Chart Replay</strong> · Built in South Africa for deliberate trader development · Simulated capital only.<br/>
              Need help? Reply to this email or contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a> · <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:underline;">chartreplay.co.za</a><br/>
              <span style="color:#475569;">Don't want to receive these emails?</span> <a href="${safeUnsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;text-decoration:underline;font-weight:600;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text, unsubscribeUrl: targetUnsubscribeUrl };
}

export function buildPasswordResetEmail({ name, email, resetUrl, expiresMinutes = 30 }) {
  const cleanName = escapeHtml(String(name || 'Trader').trim() || 'Trader');
  const rawReset = String(resetUrl || '').trim();
  const normalizedResetUrl = rawReset.replace(
    /^https?:\/\/[^/]+/i,
    DEFAULT_APP_URL
  );
  const safeResetUrl = escapeHtml(normalizedResetUrl);
  const safeEmail = escapeHtml(String(email || '').trim().toLowerCase());
  const subject = 'Reset your Chart Replay password';

  const text = [
    `Hi ${String(name || 'Trader').trim() || 'Trader'},`,
    '',
    'We received a request to reset the password for your Chart Replay account.',
    '',
    'Click the secure link below to choose a new password:',
    normalizedResetUrl,
    '',
    `This secure link expires in ${expiresMinutes} minutes and can only be used once.`,
    '',
    'If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.',
    '',
    'Chart Replay · https://chartreplay.co.za · info@chartreplay.co.za',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#050811;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050811;padding:36px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#0b111e;border:1px solid #1e293b;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.65);">
          <!-- Top Brand Banner -->
          <tr>
            <td style="padding:0;background-color:#080d18;border-bottom:1px solid #1e293b;">
              <a href="${DEFAULT_APP_URL}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
                <img src="${WELCOME_BANNER_URL}" alt="Chart Replay — Account Security" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Header Copy -->
          <tr>
            <td style="padding:32px 34px 20px 34px;background:linear-gradient(180deg,#0f1829 0%,#0b111e 100%);">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background-color:rgba(56,189,248,0.14);border:1px solid rgba(56,189,248,0.35);color:#38bdf8;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                Account Security · Password Reset
              </div>
              <h1 style="margin:16px 0 10px 0;font-size:25px;line-height:1.25;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                Reset your Chart Replay password
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#cbd5e1;">
                Hi ${cleanName}, we received a request to reset the password for your account (<strong style="color:#ffffff;">${safeEmail}</strong>) on <a href="${DEFAULT_APP_URL}" style="color:#38bdf8;text-decoration:none;font-weight:600;">chartreplay.co.za</a>.
              </p>
            </td>
          </tr>

          <!-- Primary Reset CTA -->
          <tr>
            <td style="padding:6px 34px 26px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius:14px;background:linear-gradient(90deg,#10b981 0%,#0ea5e9 55%,#2563eb 100%);box-shadow:0 10px 25px rgba(14,165,233,0.25);">
                    <a href="${safeResetUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:14px;">
                      Choose a New Password →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Details & Direct Link -->
          <tr>
            <td style="padding:0 34px 28px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080d17;border:1px solid #1e293b;border-radius:16px;margin-bottom:20px;">
                <tr>
                  <td style="padding:18px 20px;font-size:13px;line-height:1.65;color:#94a3b8;">
                    <div style="margin-bottom:8px;">
                      <strong style="color:#34d399;">✓ Single-Use Security Link:</strong> This link is valid for <strong style="color:#ffffff;">${Number(expiresMinutes)} minutes</strong> and automatically expires as soon as your password is updated.
                    </div>
                    <div>
                      <strong style="color:#38bdf8;">✓ Didn’t request this?</strong> You can safely ignore this email. Your existing password remains secure and untouched.
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:1.65;color:#64748b;word-break:break-all;">
                If the button above doesn’t open automatically, copy and paste this official link into your browser:<br/>
                <a href="${safeResetUrl}" style="color:#38bdf8;text-decoration:underline;">${safeResetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 34px;background-color:#070b14;border-top:1px solid #1e293b;font-size:11px;line-height:1.7;color:#64748b;text-align:center;">
              <strong style="color:#94a3b8;">Chart Replay</strong> · Built in South Africa · Simulated capital only.<br/>
              Need assistance? Contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a> · <a href="${DEFAULT_APP_URL}" style="color:#38bdf8;text-decoration:underline;">chartreplay.co.za</a>
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
      unsubscribeUrl: content.unsubscribeUrl,
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

export function buildFirstTradeFeedbackEmail({
  name,
  email,
  feedbackUrl,
  unsubscribeUrl,
  appUrl = DEFAULT_APP_URL,
}) {
  const rawName = String(name || 'Trader').trim() || 'Trader';
  const cleanName = escapeHtml(rawName);
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const safeAppUrl = escapeHtml(officialUrl);
  const cleanEmailRaw = String(email || '').trim().toLowerCase();
  const safeEmail = escapeHtml(cleanEmailRaw);
  const targetFeedbackUrl =
    String(feedbackUrl || '').trim() ||
    `${officialUrl}/?feedback=1&email=${encodeURIComponent(
      cleanEmailRaw
    )}&name=${encodeURIComponent(rawName)}`;
  const safeFeedbackUrl = escapeHtml(targetFeedbackUrl);
  const targetUnsubscribeUrl =
    String(unsubscribeUrl || '').trim() || buildUnsubscribeUrl(cleanEmailRaw, officialUrl);
  const safeUnsubscribeUrl = escapeHtml(targetUnsubscribeUrl);
  const subject = `Hi ${rawName} — We saw you placed your first trade! How did you find our platform?`;

  const text = [
    `Hi ${rawName},`,
    '',
    'We saw you placed your first trade on Chart Replay! How did you find our platform? Is it user-friendly?',
    '',
    'Let us know if we can improve it and where we can improve it. Your feedback is valuable.',
    '',
    'Click here to give us feedback and rate our platform (1 to 5 stars for User Friendliness, Charts, and Smoothness):',
    targetFeedbackUrl,
    '',
    'Thank you for practicing with us!',
    'Chart Replay · https://chartreplay.co.za · info@chartreplay.co.za',
    `Unsubscribe from emails: ${targetUnsubscribeUrl}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#050811;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050811;padding:36px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#0b111e;border:1px solid #1e293b;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.65);">
          <!-- Top Brand Banner -->
          <tr>
            <td style="padding:0;background-color:#080d18;border-bottom:1px solid #1e293b;">
              <a href="${safeFeedbackUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
                <img src="${WELCOME_BANNER_URL}" alt="Chart Replay — Trader Feedback" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Greeting & Main Message -->
          <tr>
            <td style="padding:32px 34px 20px 34px;background:linear-gradient(180deg,#0f1829 0%,#0b111e 100%);">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background-color:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                First Trade Milestone · Trader Feedback
              </div>
              <h1 style="margin:16px 0 12px 0;font-size:25px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                Hi ${cleanName}, we saw you placed your first trade!
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                How did you find our platform? Is it user-friendly?
              </p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                Let us know if we can improve it and where we can improve it. <strong style="color:#ffffff;">Your feedback is valuable.</strong>
              </p>
            </td>
          </tr>

          <!-- 3 Star Rating Categories Preview -->
          <tr>
            <td style="padding:4px 34px 22px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080d17;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #162032;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;font-weight:700;color:#ffffff;">1. User Friendliness</td>
                        <td align="right" style="font-size:15px;color:#fbbf24;letter-spacing:2px;">★★★★★</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #162032;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;font-weight:700;color:#ffffff;">2. Charts &amp; Tools</td>
                        <td align="right" style="font-size:15px;color:#fbbf24;letter-spacing:2px;">★★★★★</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;font-weight:700;color:#ffffff;">3. Smoothness &amp; Speed</td>
                        <td align="right" style="font-size:15px;color:#fbbf24;letter-spacing:2px;">★★★★★</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="margin-top:8px;font-size:11px;color:#64748b;text-align:center;">
                Rate each from 1 to 5 stars (5 is the best!) and share your thoughts in 30 seconds.
              </div>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding:0 34px 28px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius:14px;background:linear-gradient(90deg,#10b981 0%,#0ea5e9 55%,#2563eb 100%);box-shadow:0 10px 25px rgba(16,185,129,0.28);">
                    <a href="${safeFeedbackUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:14px;">
                      Click Here to Give Us Feedback →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">
                Or open this direct link in your browser:<br/>
                <a href="${safeFeedbackUrl}" style="color:#38bdf8;text-decoration:underline;">${safeFeedbackUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 34px;background-color:#070b14;border-top:1px solid #1e293b;font-size:11px;line-height:1.7;color:#64748b;text-align:center;">
              <strong style="color:#94a3b8;">Chart Replay</strong> · Sent to <span style="color:#94a3b8;">${safeEmail}</span><br/>
              Need assistance? Reply to this email or contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a> · <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:underline;">chartreplay.co.za</a><br/>
              <span style="color:#475569;">Don't want to receive these emails?</span> <a href="${safeUnsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;text-decoration:underline;font-weight:600;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text, feedbackUrl: targetFeedbackUrl, unsubscribeUrl: targetUnsubscribeUrl };
}

export async function sendFirstTradeFeedbackEmail(
  { name, email, origin },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || 'Trader').trim() || 'Trader';
  const feedbackUrl = `${appUrl}/?feedback=1&email=${encodeURIComponent(
    cleanEmail
  )}&name=${encodeURIComponent(cleanName)}`;
  const content = buildFirstTradeFeedbackEmail({
    name: cleanName,
    email: cleanEmail,
    feedbackUrl,
    appUrl,
  });
  const result = await sendResendEmail(
    {
      to: cleanEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      unsubscribeUrl: content.unsubscribeUrl,
    },
    { env, request }
  );
  return { ...result, feedbackUrl };
}

const CONTACT_CATEGORY_LABELS = {
  general_inquiry: 'General Inquiry',
  partnership: 'Partnership Opportunity',
  improvement: 'Platform Improvement',
  bug: 'Bug Report',
};

export function formatContactCategoryLabel(category) {
  const key = String(category || 'general_inquiry').trim().toLowerCase();
  return CONTACT_CATEGORY_LABELS[key] || 'General Inquiry';
}

export function buildContactInquiryEmail({
  name,
  email,
  category = 'general_inquiry',
  subject = '',
  message = '',
  createdAt = new Date().toISOString(),
  appUrl = DEFAULT_APP_URL,
}) {
  const rawName = String(name || 'Trader').trim() || 'Trader';
  const cleanName = escapeHtml(rawName);
  const rawEmail = String(email || '').trim().toLowerCase();
  const safeEmail = escapeHtml(rawEmail);
  const categoryLabel = formatContactCategoryLabel(category);
  const safeCategory = escapeHtml(categoryLabel);
  const rawSubject =
    String(subject || '').trim() || `${categoryLabel} from ${rawName}`;
  const safeSubject = escapeHtml(rawSubject);
  const safeMessage = escapeHtml(String(message || '').trim()).replace(
    /\r?\n/g,
    '<br/>'
  );
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const safeAdminUrl = escapeHtml(`${officialUrl}/admin`);
  const emailSubject = `[Chart Replay · ${categoryLabel}] ${rawSubject}`;

  const text = [
    `New ${categoryLabel} received via Chart Replay Contact Us form:`,
    '',
    `Category: ${categoryLabel}`,
    `From: ${rawName} <${rawEmail}>`,
    `Subject: ${rawSubject}`,
    `Submitted At: ${createdAt}`,
    '',
    'Message:',
    String(message || '').trim(),
    '',
    `View in Administrator Dashboard: ${officialUrl}/admin`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(emailSubject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#050811;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050811;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#0b111e;border:1px solid #1e293b;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 18px 32px;background:linear-gradient(180deg,#0f1829 0%,#0b111e 100%);border-bottom:1px solid #1e293b;">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background-color:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                Contact Us · ${safeCategory}
              </div>
              <h1 style="margin:14px 0 6px 0;font-size:22px;line-height:1.3;font-weight:800;color:#ffffff;">
                ${safeSubject}
              </h1>
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                From <strong style="color:#ffffff;">${cleanName}</strong> (<a href="mailto:${safeEmail}" style="color:#38bdf8;text-decoration:underline;">${safeEmail}</a>)
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <div style="padding:18px 20px;background-color:#080d17;border:1px solid #1e293b;border-radius:14px;font-size:14px;line-height:1.65;color:#e2e8f0;">
                ${safeMessage || '<em>No message text provided.</em>'}
              </div>
              <div style="margin-top:20px;text-align:center;">
                <a href="${safeAdminUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(90deg,#10b981 0%,#0ea5e9 100%);color:#050811;font-size:13px;font-weight:800;text-decoration:none;">
                  Open Administrator Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#070b14;border-top:1px solid #1e293b;font-size:11px;color:#64748b;text-align:center;">
              Routed to <strong>${escapeHtml(CONTACT_INQUIRY_RECIPIENT)}</strong> · Hit Reply to respond directly to ${cleanName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: emailSubject, html, text };
}

export async function sendContactInquiryEmail(
  { name, email, category, subject, message, createdAt, origin },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const recipient =
    String(env.CONTACT_RECIPIENT_EMAIL || CONTACT_INQUIRY_RECIPIENT)
      .trim()
      .toLowerCase() || CONTACT_INQUIRY_RECIPIENT;
  const content = buildContactInquiryEmail({
    name,
    email,
    category,
    subject,
    message,
    createdAt,
    appUrl,
  });
  const result = await sendResendEmail(
    {
      to: recipient,
      replyTo: String(email || '').trim().toLowerCase() || recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
    },
    { env, request }
  );
  return { ...result, recipientEmail: recipient };
}

export async function sendFeedbackNotificationEmail(
  {
    name,
    email,
    ratingUserFriendliness,
    ratingCharts,
    ratingSmoothness,
    overallRating,
    improvementsText,
    favoriteText,
    source,
    origin,
  },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const recipient =
    String(env.CONTACT_RECIPIENT_EMAIL || CONTACT_INQUIRY_RECIPIENT)
      .trim()
      .toLowerCase() || CONTACT_INQUIRY_RECIPIENT;
  const rawName = String(name || 'Trader').trim() || 'Trader';
  const rawEmail = String(email || '').trim().toLowerCase();
  const subject = `[Chart Replay · Trader Review ${overallRating}★] Feedback from ${rawName}`;
  const text = [
    `New Trader Experience Review (${overallRating} / 5.0 ★)`,
    `From: ${rawName} <${rawEmail}>`,
    `Source: ${source || 'platform'}`,
    '',
    `Ratings:`,
    `- User Friendliness: ${ratingUserFriendliness}/5`,
    `- Charts & Tools: ${ratingCharts}/5`,
    `- Smoothness: ${ratingSmoothness}/5`,
    '',
    `How was your experience / How can we improve:`,
    improvementsText || '(No written comment)',
    favoriteText ? `\nFavorite part:\n${favoriteText}` : '',
    '',
    `View in Administrator Dashboard: ${appUrl}/admin`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<div style="font-family:sans-serif;background:#0b111e;color:#e2e8f0;padding:24px;border-radius:16px;border:1px solid #1e293b;max-width:580px;">
    <h2 style="margin:0 0 8px 0;color:#34d399;">New Trader Experience Review (${escapeHtml(overallRating)} / 5.0 ★)</h2>
    <p style="margin:0 0 16px 0;font-size:13px;color:#94a3b8;">From <strong style="color:#fff;">${escapeHtml(rawName)}</strong> (${escapeHtml(rawEmail)}) · Source: ${escapeHtml(source || 'platform')}</p>
    <p style="font-size:13px;color:#fbbf24;">User Friendliness: <strong>${escapeHtml(ratingUserFriendliness)}★</strong> · Charts: <strong>${escapeHtml(ratingCharts)}★</strong> · Smoothness: <strong>${escapeHtml(ratingSmoothness)}★</strong></p>
    <div style="padding:14px;background:#080d17;border:1px solid #1e293b;border-radius:12px;font-size:14px;line-height:1.6;color:#e2e8f0;">
      <strong>How was your experience &amp; how we can improve:</strong><br/>
      ${escapeHtml(improvementsText || 'No written comment provided.').replace(/\r?\n/g, '<br/>')}
    </div>
  </div>`;

  return sendResendEmail(
    {
      to: recipient,
      replyTo: rawEmail || recipient,
      subject,
      html,
      text,
    },
    { env, request }
  );
}

export const DEFAULT_NEWSLETTER_TEMPLATES = [
  {
    id: 'newsletter-day-1',
    dayNumber: 1,
    cadence: 'daily',
    category: 'prop_firm',
    phaseLabel: 'Prop Firm Evaluation Playbook',
    badgeText: 'Prop Firm Playbook · 5 Steps',
    subject: 'Hi {{firstName}} — 5 Steps How to Pass a Prop Firm Challenge Without Stress',
    headline: 'Hi {{firstName}}, consistency beats home runs in every prop firm evaluation.',
    bodyText:
      'Most traders fail prop firm challenges because they try to pass in two days.\n\nFunded professionals pass because they protect their drawdown first and compound steady base hits using {{tradingPlanName}}.\n\n1. Protect Your Daily Drawdown First — Treat your daily loss limit as an unbreakable wall by risking 0.25% to 0.5% per setup so one bad session never ends your evaluation.\n2. Focus on 1–2 Liquid Pairs in Your Killzone — Master Gold (XAU/USD), NAS100, or EUR/USD during the London or New York open instead of forcing trades across ten different charts.\n3. Pin Your Sticky Trading Plan on the Chart — Keep your entry checklist visible right on your chart so you never improvise while candles are moving.\n4. Aim for Steady 1:2 R Base Hits — You do not need a 90% win rate to get funded. Three to four clean 1:2 R setups are enough to pass safely without emotional swings.\n5. Rehearse in the Chart Replay Prop Simulator First — Validate 20+ setups bar-by-bar under real 1-Step and 2-Step drawdown rules on Chart Replay before risking evaluation fees.',
    steps: [
      {
        title: 'Protect Your Daily Drawdown First',
        description:
          'Treat your daily loss limit as an unbreakable wall by risking 0.25% to 0.5% per setup so one bad session never ends your evaluation.',
      },
      {
        title: 'Focus on 1–2 Liquid Pairs in Your Killzone',
        description:
          'Master Gold (XAU/USD), NAS100, or EUR/USD during the London or New York open instead of forcing trades across ten different charts.',
      },
      {
        title: 'Pin Your Sticky Trading Plan on the Chart',
        description:
          'Keep your entry checklist visible right on your chart so you never improvise while candles are moving.',
      },
      {
        title: 'Aim for Steady 1:2 R Base Hits',
        description:
          'You do not need a 90% win rate to get funded. Three to four clean 1:2 R setups are enough to pass safely without emotional swings.',
      },
      {
        title: 'Rehearse in the Chart Replay Prop Simulator First',
        description:
          'Validate 20+ setups bar-by-bar under real 1-Step and 2-Step drawdown rules on Chart Replay before risking evaluation fees.',
      },
    ],
    actionTip:
      'Open a Prop Firm Challenge session on Chart Replay today, pin your trading plan on the chart, and execute 3 textbook trades with zero drawdown rule violations.',
    ctaText: 'Open Prop Firm Simulator →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-2',
    dayNumber: 2,
    cadence: 'daily',
    category: 'psychology',
    phaseLabel: 'Trading Psychology & Emotional Control',
    badgeText: 'Trading Psychology · 5 Steps',
    subject: 'Hi {{firstName}} — 5 Steps to Eliminate Revenge Trading Before the Next Candle Closes',
    headline: 'Your response to a red trade defines your trading career, {{firstName}}.',
    bodyText:
      'A loss that followed {{tradingPlanName}} is still a good trade — it is simply the cost of doing business in probability. The danger is never the first loss; it is the impulsive revenge trade taken two minutes later to "make it back."\n\n1. Accept a Rule-Following Loss as Business Overhead — Even the best institutional edge loses 30% to 45% of the time. Judge yourself by rule execution, never by a single candle outcome.\n2. Enforce a Mandatory 60-Second Chart Pause — After any stop-out, take your hand off the mouse for 60 seconds so adrenaline cannot hijack your next decision.\n3. Never Double Your Lot Size to "Win It Back" — Keep your risk percentage fixed on every order ticket. Oversized recovery trades are the #1 destroyer of funded accounts.\n4. Check In With Coach Michael & Log Your State — Use the mindset check-in on Chart Replay to pause, reset your breathing, and record one honest note in your journal.\n5. Set a Hard 2-Loss Session Stop Rule — If you take two consecutive losses in one session, close the workspace and review the replay with fresh eyes tomorrow.',
    steps: [
      {
        title: 'Accept a Rule-Following Loss as Business Overhead',
        description:
          'Even the best institutional edge loses 30% to 45% of the time. Judge yourself by rule execution, never by a single candle outcome.',
      },
      {
        title: 'Enforce a Mandatory 60-Second Chart Pause',
        description:
          'After any stop-out, take your hand off the mouse for 60 seconds so adrenaline cannot hijack your next decision.',
      },
      {
        title: 'Never Double Your Lot Size to "Win It Back"',
        description:
          'Keep your risk percentage fixed on every order ticket. Oversized recovery trades are the #1 destroyer of funded accounts.',
      },
      {
        title: 'Check In With Coach Michael & Log Your State',
        description:
          'Use the mindset check-in on Chart Replay to pause, reset your breathing, and record one honest note in your journal.',
      },
      {
        title: 'Set a Hard 2-Loss Session Stop Rule',
        description:
          'If you take two consecutive losses in one session, close the workspace and review the replay with fresh eyes tomorrow.',
      },
    ],
    actionTip:
      'Make a personal rule today: after any losing trade in replay, pause for 30 seconds, take a deep breath, and verify market structure before looking for another entry.',
    ctaText: 'Practice Emotional Discipline →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-3',
    dayNumber: 3,
    cadence: 'daily',
    category: 'reengagement',
    phaseLabel: 'Comeback Motivation · Inactive 2–3+ Days',
    badgeText: 'We Missed You · 3 Steps to Return',
    subject: 'Hi {{firstName}} — We missed you on Chart Replay! 3 steps to get back in rhythm',
    headline: 'Hi {{firstName}}, it has been a few days — let’s get your chart rhythm back.',
    bodyText:
      'Stepping away from the charts for two or three days happens to every trader, but real consistency comes from how quickly you reconnect with your process. Your Chart Replay workspace and {{tradingPlanName}} are ready whenever you are — with zero financial risk.\n\n1. Run a Quick 10-Minute Warm-Up Replay — Do not pressure yourself to trade for hours. Open your favorite pair and step through 30 historical candles at your own pace.\n2. Refresh Your On-Chart Sticky Trading Plan — Read your core entry rules on the chart so your eyes immediately lock onto clean market structure and liquidity sweeps.\n3. Execute One Clean A+ Setup Today — Place just one well-planned simulated trade following every rule on your checklist to reignite your momentum.',
    steps: [
      {
        title: 'Run a Quick 10-Minute Warm-Up Replay',
        description:
          'Do not pressure yourself to trade for hours. Open your favorite pair and step through 30 historical candles at your own pace.',
      },
      {
        title: 'Refresh Your On-Chart Sticky Trading Plan',
        description:
          'Read your core entry rules on the chart so your eyes immediately lock onto clean market structure and liquidity sweeps.',
      },
      {
        title: 'Execute One Clean A+ Setup Today',
        description:
          'Place just one well-planned simulated trade following every rule on your checklist to reignite your momentum.',
      },
    ],
    actionTip:
      'Jump back into Chart Replay for just 10 minutes today and complete one focused bar-by-bar session on Gold (XAU/USD) or NAS100.',
    ctaText: 'Jump Back Into Your Workspace →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'inactive_2_3_days',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-4',
    dayNumber: 4,
    cadence: 'daily',
    category: 'execution',
    phaseLabel: 'Institutional Patience & Setup Selection',
    badgeText: 'Execution & Edge · 5 Steps',
    subject: '{{firstName}}, 5 steps to stop overtrading and wait for your A+ setup',
    headline: 'Sitting on your hands until structure aligns is your biggest edge, {{firstName}}.',
    bodyText:
      'One of the biggest breakthroughs in becoming a consistently profitable trader is realizing that 80% of market noise is not meant for you. Professional traders wait calmly for price to enter their session window and trigger {{tradingPlanName}}.\n\n1. Define What a "No-Trade Market" Looks Like — Write down the exact tight-range or low-volume conditions where you commit to staying 100% flat.\n2. Fast-Forward Past Choppy Consolidation — Use Chart Replay’s bar-by-bar stepping controls to skip low-probability chop until London or New York momentum arrives.\n3. Let Price Come to Your Key Level First — Mark your higher-timeframe liquidity and supply/demand zones before stepping forward, and never chase mid-range candles.\n4. Read Your Sticky Plan Out Loud Before Clicking — If even one condition on your checklist is missing, advance one candle and wait.\n5. Measure Success by Bad Trades Avoided — Protecting your capital during messy price action is a winning session.',
    steps: [
      {
        title: 'Define What a "No-Trade Market" Looks Like',
        description:
          'Write down the exact tight-range or low-volume conditions where you commit to staying 100% flat.',
      },
      {
        title: 'Fast-Forward Past Choppy Consolidation',
        description:
          'Use Chart Replay’s bar-by-bar stepping controls to skip low-probability chop until London or New York momentum arrives.',
      },
      {
        title: 'Let Price Come to Your Key Level First',
        description:
          'Mark your higher-timeframe liquidity and supply/demand zones before stepping forward, and never chase mid-range candles.',
      },
      {
        title: 'Read Your Sticky Plan Out Loud Before Clicking',
        description:
          'If even one condition on your checklist is missing, advance one candle and wait.',
      },
      {
        title: 'Measure Success by Bad Trades Avoided',
        description:
          'Protecting your simulated capital during messy price action is a winning session.',
      },
    ],
    actionTip:
      'Practice skipping at least 20 candles of sideways chop in your replay session today until a textbook London or New York setup forms.',
    ctaText: 'Practice Patience on the Chart →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-5',
    dayNumber: 5,
    cadence: 'daily',
    category: 'risk',
    phaseLabel: 'Risk Management & R-Multiples',
    badgeText: 'Risk Management · 4 Steps',
    subject: 'Hi {{firstName}} — 4 steps to detach from money and trade in R-Multiples',
    headline: 'Master execution quality by measuring every trade in R-Multiples, {{firstName}}.',
    bodyText:
      'When you stare at dollar or rand fluctuations while a trade is open, fear makes you close winners too early and hope makes you hold losers too long. Professional traders measure {{tradingPlanName}} strictly in R-Multiples (Risk Units).\n\n1. Think in 1R Risk Units, Not Currency — Whether 1R is $50 or $5,000, the chart structure and execution discipline are 100% identical.\n2. Size Every Position by Stop-Loss Distance — Use the Chart Replay Order Ticket calculator so a wider structural stop automatically adjusts your lot size.\n3. Target Clean 1:2 to 1:3 R Setups — With a 2.5R average winner, you only need a 40% win rate to grow your account equity curve steadily.\n4. Let the Replay Bars Play Out Without Touching Your Stop — Set your stop-loss and take-profit before entry, then step the candles forward to +R or -1R with total composure.',
    steps: [
      {
        title: 'Think in 1R Risk Units, Not Currency',
        description:
          'Whether 1R is $50 or $5,000, the chart structure and execution discipline are 100% identical.',
      },
      {
        title: 'Size Every Position by Stop-Loss Distance',
        description:
          'Use the Chart Replay Order Ticket calculator so a wider structural stop automatically adjusts your lot size.',
      },
      {
        title: 'Target Clean 1:2 to 1:3 R Setups',
        description:
          'With a 2.5R average winner, you only need a 40% win rate to grow your account equity curve steadily.',
      },
      {
        title: 'Let the Replay Bars Play Out Without Touching Your Stop',
        description:
          'Set your stop-loss and take-profit before entry, then step the candles forward to +R or -1R with total composure.',
      },
    ],
    actionTip:
      'Set your stop-loss and take-profit before entering your next replay trade, then let the bars play out to +R or -1R without moving your stop-loss.',
    ctaText: 'Build R-Multiple Consistency →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-7',
    dayNumber: 6,
    cadence: 'every_second_day',
    category: 'playbook',
    phaseLabel: 'Rule-Based Trading Playbook',
    badgeText: 'Trading Playbook · 5 Steps',
    subject: '{{firstName}}, 5 steps to treat your Trading Plan like a high-performance business',
    headline: 'Amateur traders improvise; professionals execute a written checklist, {{firstName}}.',
    bodyText:
      'Every consistently profitable trader operates from a concise, repeatable playbook. When {{tradingPlanName}} is visible right on your chart, hesitation disappears.\n\n1. Keep Your Rules Short Enough for a Sticky Note — Simplify your strategy into 3 to 5 objective chart conditions you can verify in 10 seconds.\n2. Define Your Exact Session Killzone — Specify whether you trade London Open, New York Open, or Silver Bullet hours so you only practice high-volume setups.\n3. Pre-Define Your Invalidations — Know the exact candle closure that invalidates your setup before opening the order ticket.\n4. Log a 1-Sentence Reason for Every Entry — Record why you took each trade so you can review your best-performing patterns in Analytics.\n5. Audit 10 Replay Trades Against Your Checklist — Check how many of your last 10 trades followed your plan 100% and aim for a 95%+ compliance score.',
    steps: [
      {
        title: 'Keep Your Rules Short Enough for a Sticky Note',
        description:
          'Simplify your strategy into 3 to 5 objective chart conditions you can verify in 10 seconds.',
      },
      {
        title: 'Define Your Exact Session Killzone',
        description:
          'Specify whether you trade London Open, New York Open, or Silver Bullet hours so you only practice high-volume setups.',
      },
      {
        title: 'Pre-Define Your Invalidations',
        description:
          'Know the exact candle closure that invalidates your setup before opening the order ticket.',
      },
      {
        title: 'Log a 1-Sentence Reason for Every Entry',
        description:
          'Record why you took each trade so you can review your best-performing patterns in Analytics.',
      },
      {
        title: 'Audit 10 Replay Trades Against Your Checklist',
        description:
          'Check how many of your last 10 trades followed your plan 100% and aim for a 95%+ compliance score.',
      },
    ],
    actionTip:
      'Open your chart workspace, click My Plan, and make sure your top 3 entry rules are pinned clearly before placing your next trade.',
    ctaText: 'Review My Trading Plan & Practice →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-9',
    dayNumber: 7,
    cadence: 'every_second_day',
    category: 'practice',
    phaseLabel: 'Deliberate Bar-by-Bar Practice',
    badgeText: 'Deliberate Practice · 5 Steps',
    subject: '{{firstName}}, 5 steps to compress 6 months of market experience into one week',
    headline: 'Deliberate bar-by-bar practice is your unfair advantage, {{firstName}}.',
    bodyText:
      'Waiting for live candles takes months to see 50 examples of your setup. On Chart Replay, you can step through 50 real historical setups on Gold (XAU/USD), NAS100, and Forex majors in a single weekend.\n\n1. Lock In One Instrument for 20 Straight Trades — Build deep intuition on how one market sweeps liquidity and reacts at key session highs and lows.\n2. Step Bar-by-Bar Without Peeking Ahead — Train your eyes to read live candle formation on the right edge of the chart.\n3. Mark Higher-Timeframe Structure First — Start on the 4H and 1H chart to map directional bias before dropping to the 15m or 5m execution chart.\n4. Review Win Rate & Profit Factor After Each Session — Use the Performance Overview dashboard to see whether long or short setups perform best for you.\n5. Refine One Filter at a Time — Tweak a single rule in {{tradingPlanName}} and run another 10-trade replay sample to verify the improvement.',
    steps: [
      {
        title: 'Lock In One Instrument for 20 Straight Trades',
        description:
          'Build deep intuition on how one market sweeps liquidity and reacts at key session highs and lows.',
      },
      {
        title: 'Step Bar-by-Bar Without Peeking Ahead',
        description:
          'Train your eyes to read live candle formation on the right edge of the chart.',
      },
      {
        title: 'Mark Higher-Timeframe Structure First',
        description:
          'Start on the 4H and 1H chart to map directional bias before dropping to the 15m or 5m execution chart.',
      },
      {
        title: 'Review Win Rate & Profit Factor After Each Session',
        description:
          'Use the Performance Overview dashboard to see whether long or short setups perform best for you.',
      },
      {
        title: 'Refine One Filter at a Time',
        description:
          'Tweak a single rule in {{tradingPlanName}} and run another 10-trade replay sample to verify the improvement.',
      },
    ],
    actionTip:
      'Run a focused 15-minute replay session on your favorite pair today and log a short note on why you entered each trade.',
    ctaText: 'Launch a Backtest Session →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
  {
    id: 'newsletter-day-11',
    dayNumber: 8,
    cadence: 'every_second_day',
    category: 'reengagement',
    phaseLabel: '3-Step Momentum Reset',
    badgeText: 'Trader Momentum · 3 Steps',
    subject: 'Hi {{firstName}} — 3 quick steps to sharpen your chart execution today',
    headline: 'Keep your pattern recognition sharp on Chart Replay, {{firstName}}.',
    bodyText:
      'Just like an athlete in the gym, staying connected to the charts a few times a week keeps your execution sharp and hesitation-free when live markets open.\n\n1. Review Your Last Replay Session’s Best Setup — Remind your eyes what a clean, effortless A+ entry on {{tradingPlanName}} looks like.\n2. Complete a 15-Minute Prop or Backtest Session — Step through one London or New York session focusing purely on risk management.\n3. Commit to Zero Impulse Entries on Your Next 5 Trades — Respect your stop-loss 100% and let the math of your edge do the heavy lifting.',
    steps: [
      {
        title: 'Review Your Last Replay Session’s Best Setup',
        description:
          'Remind your eyes what a clean, effortless A+ entry on {{tradingPlanName}} looks like.',
      },
      {
        title: 'Complete a 15-Minute Prop or Backtest Session',
        description:
          'Step through one London or New York session focusing purely on risk management.',
      },
      {
        title: 'Commit to Zero Impulse Entries on Your Next 5 Trades',
        description:
          'Respect your stop-loss 100% and let the math of your edge do the heavy lifting.',
      },
    ],
    actionTip:
      'Open Chart Replay for 15 minutes today and complete 3 disciplined trades with zero rule violations.',
    ctaText: 'Open Your Trading Workspace →',
    status: 'pending_approval',
    approved: false,
    approvedBy: null,
    approvedAt: null,
    scheduledFor: null,
    targetAudience: 'all',
    selectedRecipients: [],
    sentAt: null,
    sentCount: 0,
  },
];

export function formatDaysOnPlatformLabel(joinedAt, nowMs = Date.now()) {
  if (!joinedAt) return '1 day';
  const parsed = Date.parse(String(joinedAt));
  if (!Number.isFinite(parsed)) return '1 day';
  const days = Math.max(1, Math.floor(Math.max(0, nowMs - parsed) / 86400000) + 1);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function stripLegacyDayPrefix(text) {
  return String(text ?? '')
    .replace(/^Day\s+\d+\s*[·•:\-–—]\s*/i, '')
    .replace(/\bDaily\s+Trader\s+Motivation\b/gi, 'Trader Coaching')
    .replace(/\bEvery\s+2nd\s+Day\s+Coaching\b/gi, 'Pro Trader Coaching')
    .trim();
}

export function personalizeNewsletterText(templateText, recipient = {}, nowMs = Date.now()) {
  const rawName = String(recipient?.name || 'Trader').trim() || 'Trader';
  const firstName = rawName.split(/\s+/)[0] || 'Trader';
  const email = String(recipient?.email || 'trader@chartreplay.co.za').trim().toLowerCase();
  const sessionCount = Number(recipient?.sessionCount ?? 0);
  const tradeCount = Number(recipient?.tradeCount ?? 0);
  const rawPlan =
    typeof recipient?.tradingPlanName === 'string' && recipient.tradingPlanName.trim()
      ? `"${recipient.tradingPlanName.trim()}"`
      : recipient?.hasTradingPlan
      ? 'your personal Trading Plan'
      : 'your on-chart Sticky Trading Plan';
  const daysOnPlatform = formatDaysOnPlatformLabel(recipient?.joinedAt, nowMs);

  return String(templateText ?? '')
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, rawName)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*tradingPlanName\s*\}\}/gi, rawPlan)
    .replace(/\{\{\s*sessionCount\s*\}\}/gi, String(sessionCount))
    .replace(/\{\{\s*tradeCount\s*\}\}/gi, String(tradeCount))
    .replace(/\{\{\s*daysOnPlatform\s*\}\}/gi, daysOnPlatform);
}

export function extractNewsletterStepsAndIntro(newsletter = {}, recipient = {}, nowMs = Date.now()) {
  const rawBody = personalizeNewsletterText(
    newsletter.bodyText ||
      'Every disciplined session on Chart Replay brings you closer to professional consistency.',
    recipient,
    nowMs
  )
    .replace(/([.!?"]\s*)((?:Step\s*)?1[.):]\s+[A-Z])/g, '$1\n\n$2')
    .replace(/([.!?"]\s*)((?:Step\s*)?[2-9][.):]\s+[A-Z])/g, '$1\n$2');

  const lines = rawBody.split(/\r?\n/);
  const parsedSteps = [];
  const introLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const stepMatch = trimmed.match(/^(?:Step\s*)?(\d+)[.):]\s*(.+)$/i);
    if (stepMatch) {
      const rest = stepMatch[2].trim();
      const sepMatch = rest.match(/^([^—–\-:]+?)\s*(?:—|–|\s-\s|:)\s*(.+)$/);
      if (sepMatch) {
        parsedSteps.push({
          title: sepMatch[1].trim(),
          description: sepMatch[2].trim(),
        });
      } else {
        parsedSteps.push({
          title: `Step ${parsedSteps.length + 1}`,
          description: rest,
        });
      }
    } else {
      introLines.push(line);
    }
  }

  let steps = [];
  if (parsedSteps.length > 0) {
    steps = parsedSteps;
  } else if (Array.isArray(newsletter.steps) && newsletter.steps.length > 0) {
    steps = newsletter.steps
      .map((s, idx) => {
        if (typeof s === 'string') {
          const text = personalizeNewsletterText(s, recipient, nowMs);
          const sepMatch = text.match(/^([^—–\-:]+?)\s*(?:—|–|\s-\s|:)\s*(.+)$/);
          return sepMatch
            ? { title: sepMatch[1].trim(), description: sepMatch[2].trim() }
            : { title: `Step ${idx + 1}`, description: text.trim() };
        }
        return {
          title: personalizeNewsletterText(s?.title || `Step ${idx + 1}`, recipient, nowMs),
          description: personalizeNewsletterText(s?.description || '', recipient, nowMs),
        };
      })
      .filter((s) => s.title || s.description);
  }

  const rawIntroBlocks = introLines
    .join('\n')
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const introParagraphs = [];
  for (const block of rawIntroBlocks) {
    const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
    if (rawIntroBlocks.length === 1 && sentences && sentences.length >= 2) {
      const firstSentence = sentences[0].trim();
      const remaining = sentences.slice(1).join(' ').trim();
      if (firstSentence) introParagraphs.push(firstSentence);
      if (remaining) introParagraphs.push(remaining);
    } else {
      introParagraphs.push(block);
    }
  }

  return {
    introParagraphs,
    steps,
    fullBodyText: rawBody,
  };
}

const STEP_BADGE_STYLES = [
  'background-color:#ecfdf5;border:1px solid #a7f3d0;color:#047857;',
  'background-color:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;',
  'background-color:#f5f3ff;border:1px solid #ddd6fe;color:#6d28d9;',
  'background-color:#fffbeb;border:1px solid #fde68a;color:#b45309;',
  'background-color:#fff1f2;border:1px solid #fecdd3;color:#be123c;',
];

export function buildPersonalizedNewsletterEmail({
  newsletter = {},
  recipient = {},
  unsubscribeUrl,
  trackingId = '',
  appUrl = DEFAULT_APP_URL,
  nowMs = Date.now(),
}) {
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const safeAppUrl = escapeHtml(officialUrl);
  const rawName = String(recipient?.name || 'Trader').trim() || 'Trader';
  const firstName = rawName.split(/\s+/)[0] || 'Trader';
  const rawEmail = String(recipient?.email || 'trader@chartreplay.co.za').trim().toLowerCase();
  const safeEmail = escapeHtml(rawEmail);
  const targetUnsubscribeUrl =
    String(unsubscribeUrl || '').trim() || buildUnsubscribeUrl(rawEmail, officialUrl);
  const safeUnsubscribeUrl = escapeHtml(targetUnsubscribeUrl);

  const cleanTrackingId = String(trackingId || '').trim();
  const openTrackingUrl = cleanTrackingId
    ? `${officialUrl}/api/platform?action=newsletter-open&logId=${encodeURIComponent(
        cleanTrackingId
      )}&email=${encodeURIComponent(rawEmail)}`
    : '';
  const clickTrackingUrl = cleanTrackingId
    ? `${officialUrl}/api/platform?action=newsletter-click&logId=${encodeURIComponent(
        cleanTrackingId
      )}&email=${encodeURIComponent(rawEmail)}`
    : officialUrl;
  const safeCtaUrl = escapeHtml(clickTrackingUrl);

  const rawBadge = stripLegacyDayPrefix(
    newsletter.badgeText || 'Trader Playbook · Chart Replay'
  );
  const badgeText = personalizeNewsletterText(
    rawBadge || 'Trader Playbook · Chart Replay',
    recipient,
    nowMs
  );
  const subject = stripLegacyDayPrefix(
    personalizeNewsletterText(
      newsletter.subject || `Hi ${firstName} — Stay Disciplined & Build Your Trading Edge`,
      recipient,
      nowMs
    )
  );
  const headline = personalizeNewsletterText(
    newsletter.headline || `Hi ${firstName}, keep building your professional edge.`,
    recipient,
    nowMs
  );
  const { introParagraphs, steps, fullBodyText } = extractNewsletterStepsAndIntro(
    newsletter,
    recipient,
    nowMs
  );
  const actionTip = personalizeNewsletterText(
    newsletter.actionTip ||
      'Open Chart Replay today, review your sticky trading plan, and execute 1–2 high-probability setups.',
    recipient,
    nowMs
  );
  const ctaText = personalizeNewsletterText(
    newsletter.ctaText || 'Open Your Trading Workspace →',
    recipient,
    nowMs
  );

  const paragraphsHtml = introParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(
          p
        ).replace(/\r?\n/g, '<br/>')}</p>`
    )
    .join('');

  const stepsHtml =
    steps.length > 0
      ? `
          <!-- Step-by-Step Action Breakdown -->
          <tr>
            <td style="padding:4px 34px 24px 34px;background-color:#ffffff;">
              <div style="margin:0 0 12px 0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0284c7;">
                ${steps.length}-Step Trader Playbook
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                ${steps
                  .map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    const badgeStyle = STEP_BADGE_STYLES[idx % STEP_BADGE_STYLES.length];
                    return `
                <tr>
                  <td style="padding:16px 20px;${isLast ? '' : 'border-bottom:1px solid #e2e8f0;'}">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="38" valign="top" style="padding-right:14px;">
                          <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;${badgeStyle}font-size:13px;font-weight:800;">${
                      idx + 1
                    }</div>
                        </td>
                        <td valign="top">
                          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">${escapeHtml(
                            step.title
                          )}</div>
                          <div style="font-size:13.5px;line-height:1.6;color:#475569;">${escapeHtml(
                            step.description
                          )}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
                  })
                  .join('')}
              </table>
            </td>
          </tr>`
      : '';

  const stepsTextLines =
    steps.length > 0
      ? [
          '',
          `${steps.length}-Step Trader Playbook:`,
          ...steps.map((s, idx) => `${idx + 1}. ${s.title} — ${s.description}`),
        ]
      : [];

  const text = [
    subject,
    '',
    headline,
    '',
    ...(introParagraphs.length > 0 ? [introParagraphs.join('\n\n')] : [fullBodyText]),
    ...stepsTextLines,
    '',
    `✓ Key Action Focus:`,
    actionTip,
    '',
    `${ctaText}: ${officialUrl}`,
    '',
    `Cheslin from Chart Replay · https://chartreplay.co.za · Sent to ${rawEmail}`,
    `Unsubscribe from emails: ${targetUnsubscribeUrl}`,
  ].join('\n');

  const trackingPixelHtml = openTrackingUrl
    ? `<img src="${escapeHtml(
        openTrackingUrl
      )}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:34px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
          <!-- Top Brand Banner -->
          <tr>
            <td style="padding:0;background-color:#ffffff;border-bottom:1px solid #e2e8f0;">
              <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
                <img src="${WELCOME_BANNER_URL}" alt="Chart Replay — Professional Trader Development" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Badge & Personalized Headline -->
          <tr>
            <td style="padding:30px 34px 12px 34px;background-color:#ffffff;">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background-color:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                ${escapeHtml(badgeText)}
              </div>
              <h1 style="margin:16px 0 14px 0;font-size:23px;line-height:1.35;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">
                ${escapeHtml(headline)}
              </h1>
              ${paragraphsHtml}
            </td>
          </tr>
          ${stepsHtml}

          <!-- Pro-Trader Action Focus -->
          <tr>
            <td style="padding:0 34px 24px 34px;background-color:#ffffff;">
              <div style="padding:18px 20px;background-color:#ecfdf5;border:1px solid #6ee7b7;border-radius:16px;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#047857;margin-bottom:6px;">
                  ✓ Pro-Trader Action Focus
                </div>
                <div style="font-size:14px;line-height:1.65;color:#064e3b;font-weight:500;">
                  ${escapeHtml(actionTip)}
                </div>
              </div>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding:0 34px 30px 34px;background-color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius:14px;background:linear-gradient(90deg,#059669 0%,#0284c7 100%);box-shadow:0 8px 20px rgba(5,150,105,0.22);">
                    <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:14px;">
                      ${escapeHtml(ctaText)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 34px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.7;color:#64748b;text-align:center;">
              <strong style="color:#0f172a;">Cheslin from Chart Replay</strong> · Sent to <span style="color:#334155;font-weight:600;">${escapeHtml(rawName)} (${safeEmail})</span><br/>
              Built for deliberate trader development · Questions? Reply or email <a href="mailto:info@voomay.co.za" style="color:#059669;text-decoration:underline;font-weight:600;">info@voomay.co.za</a> · <a href="${safeAppUrl}" style="color:#0284c7;text-decoration:underline;font-weight:600;">chartreplay.co.za</a><br/>
              <span style="color:#64748b;">Don't want to receive these emails?</span> <a href="${safeUnsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#475569;text-decoration:underline;font-weight:600;">Unsubscribe</a>
              ${trackingPixelHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    headline,
    badgeText,
    bodyText: fullBodyText,
    steps,
    introParagraphs,
    actionTip,
    ctaText,
    html,
    text,
    unsubscribeUrl: targetUnsubscribeUrl,
    openTrackingUrl,
    clickTrackingUrl,
  };
}

export async function sendPersonalizedNewsletterEmail(
  { newsletter, recipient, trackingId = '', origin, nowMs = Date.now() },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const content = buildPersonalizedNewsletterEmail({
    newsletter,
    recipient,
    trackingId,
    appUrl,
    nowMs,
  });
  const result = await sendResendEmail(
    {
      to: recipient.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      unsubscribeUrl: content.unsubscribeUrl,
    },
    { env, request }
  );
  return {
    ...result,
    subject: content.subject,
  };
}

export async function fetchResendEmailStatus(
  emailId,
  { env = process.env, request = fetch } = {}
) {
  const cfg = resolveResendConfig(env);
  const cleanId = String(emailId || '').trim();
  if (!cfg || !cleanId) return null;
  try {
    const response = await request(
      `${RESEND_API_URL}/${encodeURIComponent(cleanId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    const lastEvent = String(data.last_event || '').toLowerCase();
    return {
      id: cleanId,
      lastEvent,
      opened: lastEvent === 'opened' || lastEvent === 'clicked',
      clicked: lastEvent === 'clicked',
    };
  } catch {
    return null;
  }
}

