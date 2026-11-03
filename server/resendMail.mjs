const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'Chart Replay <noreply@chartreplay.co.za>';
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
    phaseLabel: 'Beginning · Daily Habit (Day 1)',
    badgeText: 'Day 1 · Daily Trader Motivation',
    subject: 'Hi {{firstName}} — Welcome to the 1% Club: Process Over Profits Today',
    headline: 'Hi {{firstName}}, every professional trader started with one disciplined routine.',
    bodyText:
      'Most retail traders wake up looking for quick money. Professional traders wake up looking for clean execution of their edge.\n\nOn Chart Replay, your goal today is not to predict every candle — it is to follow {{tradingPlanName}} with 100% discipline. You currently have {{sessionCount}} practice sessions and {{tradeCount}} logged trades on the platform. Every bar you step through builds the pattern recognition that separates calm professionals from emotional gamblers.',
    actionTip:
      'Open one replay session today, pin your trading plan on the chart, and take only 1 to 2 A+ setups where every single rule on your checklist is met.',
    ctaText: 'Start Today’s Replay Session →',
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
    phaseLabel: 'Beginning · Daily Habit (Day 2)',
    badgeText: 'Day 2 · Daily Trader Motivation',
    subject: '{{firstName}}, your Trading Plan is your business plan — never trade without it',
    headline: 'Treat your trading like a high-performance business, {{firstName}}.',
    bodyText:
      'Amateur traders improvise while price is moving. Professional traders decide what they will do before the session even opens.\n\nWhen you have {{tradingPlanName}} visible right on your chart, hesitation disappears. Either price gives you your exact setup at your key level, or you protect your capital by staying flat. Both are winning decisions.',
    actionTip:
      'Before clicking Buy or Sell today, read your sticky trading plan out loud. If the candle does not match your rules, step forward one bar and wait.',
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
    id: 'newsletter-day-3',
    dayNumber: 3,
    cadence: 'daily',
    phaseLabel: 'Beginning · Daily Habit (Day 3)',
    badgeText: 'Day 3 · Daily Trader Motivation',
    subject: 'Patience is a position, {{firstName}} — waiting for the A+ setup',
    headline: 'Hi {{firstName}}, sitting on your hands is how institutions make their edge.',
    bodyText:
      'One of the hardest transitions in becoming a consistently profitable trader is realizing that 80% of market noise is not meant for you.\n\nYou have been on Chart Replay for {{daysOnPlatform}} and logged {{tradeCount}} trades across {{sessionCount}} sessions. Use the bar-by-bar fast-forward tool to skip choppy consolidation and train your eyes to strike only when liquidity and structure align.',
    actionTip:
      'Practice skipping at least 20 candles of sideways chop in your replay session today until a clean London or New York session setup forms.',
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
    id: 'newsletter-day-4',
    dayNumber: 4,
    cadence: 'daily',
    phaseLabel: 'Beginning · Daily Habit (Day 4)',
    badgeText: 'Day 4 · Daily Trader Motivation',
    subject: '{{firstName}}, protect your drawdown first — profits take care of themselves',
    headline: 'Risk management is the oxygen of a professional trader, {{firstName}}.',
    bodyText:
      'Any trader can hit a lucky winning streak, but only professionals keep their gains when the market shifts. Whether you are trading a Prop Firm evaluation or building your personal track record, surviving a losing trade with a controlled 0.5% to 1% risk keeps you in control.\n\nWhen your stop-loss is respected without emotion, no single trade can ever shake your confidence.',
    actionTip:
      'Use the Order Ticket calculator on Chart Replay to size your position strictly by risk percentage before entering your next trade.',
    ctaText: 'Practice Strict Risk Sizing →',
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
    phaseLabel: 'Beginning · Daily Habit (Day 5)',
    badgeText: 'Day 5 · Daily Trader Motivation',
    subject: 'Hi {{firstName}} — Stop trading money, start trading R-Multiples',
    headline: 'Detach from the currency value and master execution quality, {{firstName}}.',
    bodyText:
      'When you stare at dollar or rand fluctuations while a trade is open, fear makes you close winners too early and hope makes you hold losers too long.\n\nProfessional traders measure everything in R-Multiples (Risk Units). A well-executed 1:2.5 R trade on {{tradingPlanName}} is the exact same skill whether you are risking $50 or $5,000.',
    actionTip:
      'Set your stop-loss and take-profit before entering, then let the bars play out to either +R or -1R without moving your stop-loss.',
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
    dayNumber: 7,
    cadence: 'every_second_day',
    phaseLabel: 'Every 2nd Day · Pro Progression (Day 7)',
    badgeText: 'Day 7 · Every 2nd Day Coaching',
    subject: '{{firstName}}, how to compress 6 months of market experience into one week',
    headline: 'Deliberate practice is your unfair advantage, {{firstName}}.',
    bodyText:
      'Waiting for live candles takes months to see 50 examples of your setup. On Chart Replay, you can step through 50 setups in a single weekend.\n\nWith {{sessionCount}} sessions and {{tradeCount}} trades under your belt so far, every session you complete sharpens your intuition on Gold (XAU/USD), NAS100, and Forex majors.',
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
    id: 'newsletter-day-9',
    dayNumber: 9,
    cadence: 'every_second_day',
    phaseLabel: 'Every 2nd Day · Pro Progression (Day 9)',
    badgeText: 'Day 9 · Every 2nd Day Coaching',
    subject: 'Hi {{firstName}} — Eliminating revenge trading before the next candle closes',
    headline: 'Your response to a red trade defines your career, {{firstName}}.',
    bodyText:
      'A loss that followed {{tradingPlanName}} is a good trade — it is simply the cost of doing business in probability. The danger is never the first loss; it is the impulsive revenge trade taken two minutes later to "make it back."\n\nUse Coach Michael and your mindset check-ins on Chart Replay to pause after any loss.',
    actionTip:
      'Make a personal rule today: after any losing trade, pause the replay for 30 seconds, take a breath, and verify market structure before looking for another entry.',
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
    id: 'newsletter-day-11',
    dayNumber: 11,
    cadence: 'every_second_day',
    phaseLabel: 'Every 2nd Day · Pro Progression (Day 11)',
    badgeText: 'Day 11 · Every 2nd Day Coaching',
    subject: '{{firstName}}, the secret to passing Prop Firm Challenges without stress',
    headline: 'Consistency beats home runs in every prop evaluation, {{firstName}}.',
    bodyText:
      'Traders fail prop firm challenges because they try to pass in two days. Funded professionals pass because they aim for steady base hits while keeping their daily drawdown untouched.\n\nBy practicing inside the Chart Replay Prop Firm Simulator, you train yourself to respect daily loss limits automatically.',
    actionTip:
      'Open or continue a Prop Firm Challenge session on Chart Replay and aim for 3 textbook trades with zero drawdown rule violations.',
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
];

export function formatDaysOnPlatformLabel(joinedAt, nowMs = Date.now()) {
  if (!joinedAt) return '1 day';
  const parsed = Date.parse(String(joinedAt));
  if (!Number.isFinite(parsed)) return '1 day';
  const days = Math.max(1, Math.floor(Math.max(0, nowMs - parsed) / 86400000) + 1);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
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

export function buildPersonalizedNewsletterEmail({
  newsletter = {},
  recipient = {},
  unsubscribeUrl,
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
  const sessionCount = Number(recipient?.sessionCount ?? 0);
  const tradeCount = Number(recipient?.tradeCount ?? 0);
  const planDisplay =
    typeof recipient?.tradingPlanName === 'string' && recipient.tradingPlanName.trim()
      ? recipient.tradingPlanName.trim()
      : recipient?.hasTradingPlan
      ? 'Active Trading Plan'
      : 'Pin your plan on chart';
  const daysLabel = formatDaysOnPlatformLabel(recipient?.joinedAt, nowMs);

  const badgeText = personalizeNewsletterText(
    newsletter.badgeText || 'Daily Trader Motivation · Chart Replay',
    recipient,
    nowMs
  );
  const subject = personalizeNewsletterText(
    newsletter.subject || `Hi ${firstName} — Stay Disciplined & Build Your Trading Edge`,
    recipient,
    nowMs
  );
  const headline = personalizeNewsletterText(
    newsletter.headline || `Hi ${firstName}, keep building your professional edge.`,
    recipient,
    nowMs
  );
  const bodyText = personalizeNewsletterText(
    newsletter.bodyText ||
      'Every disciplined session on Chart Replay brings you closer to professional consistency.',
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

  const paragraphsHtml = bodyText
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#cbd5e1;">${escapeHtml(
          p
        ).replace(/\r?\n/g, '<br/>')}</p>`
    )
    .join('');

  const text = [
    subject,
    '',
    headline,
    '',
    bodyText,
    '',
    `--- Your Chart Replay Progress (${rawName}) ---`,
    `• Trading Plan: ${planDisplay}`,
    `• Practice Sessions: ${sessionCount}`,
    `• Trades Logged: ${tradeCount}`,
    `• Time on Platform: ${daysLabel}`,
    '',
    `Today's Pro-Trader Focus:`,
    actionTip,
    '',
    `${ctaText}: ${officialUrl}`,
    '',
    `Chart Replay · https://chartreplay.co.za · Sent to ${rawEmail}`,
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
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050811;padding:34px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#0b111e;border:1px solid #1e293b;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.65);">
          <!-- Top Brand Banner -->
          <tr>
            <td style="padding:0;background-color:#080d18;border-bottom:1px solid #1e293b;">
              <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
                <img src="${WELCOME_BANNER_URL}" alt="Chart Replay — Professional Trader Development" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Badge & Personalized Headline -->
          <tr>
            <td style="padding:30px 34px 16px 34px;background:linear-gradient(180deg,#0f1829 0%,#0b111e 100%);">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background-color:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                ${escapeHtml(badgeText)}
              </div>
              <h1 style="margin:16px 0 12px 0;font-size:24px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                ${escapeHtml(headline)}
              </h1>
              ${paragraphsHtml}
            </td>
          </tr>

          <!-- Personalized Trader Snapshot Card -->
          <tr>
            <td style="padding:0 34px 22px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080d17;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
                <tr>
                  <td colspan="4" style="padding:12px 18px;border-bottom:1px solid #162032;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#38bdf8;">
                    Personal Trader Snapshot · ${escapeHtml(rawName)}
                  </td>
                </tr>
                <tr>
                  <td width="25%" style="padding:14px 12px;border-right:1px solid #162032;text-align:center;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Sessions</div>
                    <div style="margin-top:4px;font-size:16px;font-weight:800;color:#34d399;">${sessionCount}</div>
                  </td>
                  <td width="25%" style="padding:14px 12px;border-right:1px solid #162032;text-align:center;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Trades</div>
                    <div style="margin-top:4px;font-size:16px;font-weight:800;color:#38bdf8;">${tradeCount}</div>
                  </td>
                  <td width="25%" style="padding:14px 12px;border-right:1px solid #162032;text-align:center;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Journey</div>
                    <div style="margin-top:4px;font-size:13px;font-weight:700;color:#a78bfa;">${escapeHtml(daysLabel)}</div>
                  </td>
                  <td width="25%" style="padding:14px 12px;text-align:center;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Trading Plan</div>
                    <div style="margin-top:4px;font-size:11px;font-weight:700;color:#fbbf24;">${escapeHtml(planDisplay)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pro-Trader Daily Action Focus -->
          <tr>
            <td style="padding:0 34px 24px 34px;">
              <div style="padding:18px 20px;background:linear-gradient(135deg,rgba(16,185,129,0.10) 0%,rgba(56,189,248,0.08) 100%);border:1px solid rgba(16,185,129,0.32);border-radius:16px;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#34d399;margin-bottom:6px;">
                  ✓ Today’s Professional Habit Focus
                </div>
                <div style="font-size:14px;line-height:1.65;color:#f1f5f9;">
                  ${escapeHtml(actionTip)}
                </div>
              </div>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding:0 34px 30px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius:14px;background:linear-gradient(90deg,#10b981 0%,#0ea5e9 55%,#2563eb 100%);box-shadow:0 10px 25px rgba(16,185,129,0.28);">
                    <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:14px;">
                      ${escapeHtml(ctaText)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 34px;background-color:#070b14;border-top:1px solid #1e293b;font-size:11px;line-height:1.7;color:#64748b;text-align:center;">
              <strong style="color:#94a3b8;">Chart Replay Trader Newsletter</strong> · Personalized for <span style="color:#cbd5e1;">${escapeHtml(rawName)} (${safeEmail})</span><br/>
              Built for deliberate trader development · Questions? Reply or email <a href="mailto:info@voomay.co.za" style="color:#34d399;text-decoration:underline;">info@voomay.co.za</a> · <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:underline;">chartreplay.co.za</a><br/>
              <span style="color:#475569;">Don't want to receive these emails?</span> <a href="${safeUnsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#94a3b8;text-decoration:underline;font-weight:600;">Unsubscribe</a>
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
    bodyText,
    actionTip,
    ctaText,
    html,
    text,
    unsubscribeUrl: targetUnsubscribeUrl,
  };
}

export async function sendPersonalizedNewsletterEmail(
  { newsletter, recipient, origin, nowMs = Date.now() },
  { env = process.env, request = fetch } = {}
) {
  const appUrl = resolvePublicAppUrl(origin, env);
  const content = buildPersonalizedNewsletterEmail({
    newsletter,
    recipient,
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

