const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'Chart Replay <noreply@chartreplay.co.za>';
const DEFAULT_REPLY_TO = 'info@chartreplay.co.za';
const DEFAULT_APP_URL = 'https://chartreplay.co.za';
const WELCOME_BANNER_URL = 'https://chartreplay.co.za/email-welcome-banner.png';

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
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const safeAppUrl = escapeHtml(officialUrl);
  const safeEmail = escapeHtml(String(email || '').trim().toLowerCase());
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
    `Registered email: ${String(email || '').trim().toLowerCase()}`,
    '',
    'Chart Replay · https://chartreplay.co.za · Simulated money only.',
    'Questions or feedback? Contact info@chartreplay.co.za.',
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
              Need help? Reply to this email or contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a> · <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:underline;">chartreplay.co.za</a>
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
  appUrl = DEFAULT_APP_URL,
}) {
  const rawName = String(name || 'Trader').trim() || 'Trader';
  const cleanName = escapeHtml(rawName);
  const officialUrl = sanitizeOfficialAppUrl(appUrl);
  const safeAppUrl = escapeHtml(officialUrl);
  const safeEmail = escapeHtml(String(email || '').trim().toLowerCase());
  const targetFeedbackUrl =
    String(feedbackUrl || '').trim() ||
    `${officialUrl}/?feedback=1&email=${encodeURIComponent(
      String(email || '').trim().toLowerCase()
    )}&name=${encodeURIComponent(rawName)}`;
  const safeFeedbackUrl = escapeHtml(targetFeedbackUrl);
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
              Need assistance? Reply to this email or contact <a href="mailto:info@chartreplay.co.za" style="color:#34d399;text-decoration:underline;">info@chartreplay.co.za</a> · <a href="${safeAppUrl}" style="color:#38bdf8;text-decoration:underline;">chartreplay.co.za</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text, feedbackUrl: targetFeedbackUrl };
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
    },
    { env, request }
  );
  return { ...result, feedbackUrl };
}
