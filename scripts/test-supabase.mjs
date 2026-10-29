import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSupabaseConfig,
  isSupabaseConfigured,
  createSupabaseAccountStore,
} from '../server/supabaseStore.mjs';
import { createPlatformHandler, createAdminSession, hashPassword } from '../server/platformAccounts.mjs';
import { createWaitlistHandler } from '../api/waitlist.js';
import { readAdminWaitlist } from '../server/waitlistStore.mjs';

const SUPABASE_ENV = {
  SUPABASE_ENABLED: 'true',
  SUPABASE_PROJECT_ID: 'vkbrwjrenkmysqlwypoc',
  SUPABASE_URL: 'https://vkbrwjrenkmysqlwypoc.supabase.co',
  SUPABASE_REST_URL: 'https://vkbrwjrenkmysqlwypoc.supabase.co/rest/v1/',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYnJ3anJlbmtteXNxbHd5cG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MzIxNjMsImV4cCI6MjEwODUwODE2M30.j3kVGWh5efEGQS5_PJC8_Uy5mnfqEFk5eWVx7wz27mk',
};

test('resolves Supabase REST configuration from credentials', () => {
  assert.equal(isSupabaseConfigured(SUPABASE_ENV), true);
  const cfg = resolveSupabaseConfig(SUPABASE_ENV);
  assert.equal(cfg.projectId, 'vkbrwjrenkmysqlwypoc');
  assert.equal(cfg.restUrl, 'https://vkbrwjrenkmysqlwypoc.supabase.co/rest/v1/');
});

test('Supabase account store supports user registration and login on public hosts without Supabase Auth', async () => {
  const rows = [];
  const mockRequest = async (url, options = {}) => {
    if (options.method === 'GET' && url.includes('platform_users')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(rows),
      };
    }
    if (options.method === 'POST' && url.includes('platform_users')) {
      const incoming = JSON.parse(options.body);
      for (const item of Array.isArray(incoming) ? incoming : [incoming]) {
        const idx = rows.findIndex((r) => r.email === item.email);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...item };
        else rows.push(item);
      }
      return {
        ok: true,
        status: 201,
        text: async () => '',
      };
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const store = createSupabaseAccountStore({
    env: SUPABASE_ENV,
    request: mockRequest,
  });
  const handler = createPlatformHandler({ store });

  const call = async (action, { method = 'POST', body = {}, cookie = '' } = {}) => {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(v) {
        this.body = JSON.parse(v);
      },
    };
    await handler(
      {
        url: `/?action=${action}`,
        method,
        body,
        headers: {
          host: 'app.chartreplay.co.za',
          origin: 'https://app.chartreplay.co.za',
          cookie,
          'content-type': 'application/json',
        },
        socket: { remoteAddress: '127.0.0.1' },
      },
      res
    );
    return res;
  };

  const statusRes = await call('status', { method: 'GET' });
  assert.equal(statusRes.statusCode, 200);
  assert.deepEqual(statusRes.body, { enabled: true, scope: 'supabase' });

  const regRes = await call('register', {
    body: {
      name: 'Supabase Trader',
      email: 'Trader@Supabase.invalid',
      password: 'StrongPassword123',
    },
  });
  assert.equal(regRes.statusCode, 201);
  assert.equal(regRes.body.user.email, 'trader@supabase.invalid');
  assert.equal(regRes.body.user.loginCount, 1);
  assert.ok(!('passwordHash' in regRes.body.user));

  const loginRes = await call('login', {
    body: {
      email: 'trader@supabase.invalid',
      password: 'StrongPassword123',
    },
  });
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.user.loginCount, 2);
});

test('Supabase waitlist handler saves and reads entries via PostgREST', async () => {
  const waitlistRows = [];
  const mockRequest = async (url, options = {}) => {
    if (options.method === 'POST' && url.includes('waitlist_entries')) {
      const body = JSON.parse(options.body);
      if (!waitlistRows.some((r) => r.email === body.email)) {
        waitlistRows.push(body);
      }
      return { ok: true, status: 201, text: async () => '' };
    }
    if (options.method === 'GET' && url.includes('waitlist_entries')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(waitlistRows),
      };
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const handler = createWaitlistHandler({
    env: SUPABASE_ENV,
    request: mockRequest,
  });

  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(v) {
      this.body = JSON.parse(v);
    },
  };
  await handler(
    {
      method: 'POST',
      body: {
        name: 'Early Trader',
        email: 'EARLY@example.invalid',
        consent: true,
        website: '',
      },
      headers: {
        host: 'app.chartreplay.co.za',
        origin: 'https://app.chartreplay.co.za',
        'content-type': 'application/json',
      },
      socket: { remoteAddress: '127.0.0.1' },
    },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);

  const listed = await readAdminWaitlist({
    env: SUPABASE_ENV,
    request: mockRequest,
  });
  assert.equal(listed.source, 'supabase');
  assert.equal(listed.entries.length, 1);
  assert.equal(listed.entries[0].email, 'early@example.invalid');
});

test('Administrator can update sponsorship logo and wording in Supabase while unauthenticated or unsafe writes are blocked', async () => {
  const sponsorshipRows = [];
  const adminEmail = 'admin@chartreplay.local';
  const adminHash = await hashPassword('AdminPass-123');
  const envWithAdmin = {
    ...SUPABASE_ENV,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD_HASH: adminHash,
    ADMIN_SESSION_SECRET: 'test-supabase-session-secret',
  };

  const mockRequest = async (url, options = {}) => {
    if (options.method === 'POST' && url.includes('platform_sponsorship')) {
      const body = JSON.parse(options.body);
      sponsorshipRows.splice(0, sponsorshipRows.length, body);
      return { ok: true, status: 201, text: async () => '' };
    }
    if (options.method === 'GET' && url.includes('platform_sponsorship')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(sponsorshipRows),
      };
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const store = createSupabaseAccountStore({
    env: envWithAdmin,
    request: mockRequest,
  });
  const handler = createPlatformHandler({ store });

  const call = async (action, { method = 'POST', body = {}, cookie = '' } = {}) => {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(v) {
        this.body = JSON.parse(v);
      },
    };
    await handler(
      {
        url: `/?action=${action}`,
        method,
        body,
        headers: {
          host: 'app.chartreplay.co.za',
          origin: 'https://app.chartreplay.co.za',
          cookie,
          'content-type': 'application/json',
        },
        socket: { remoteAddress: '127.0.0.1' },
      },
      res
    );
    return res;
  };

  // 1. Unauthenticated POST is rejected with 401
  const unauthRes = await call('sponsorship', {
    body: { sponsorName: 'FTMO' },
  });
  assert.equal(unauthRes.statusCode, 401);

  // 2. Authenticated admin can update logo and wording in Supabase
  const cfg = await store.config();
  const adminCookie = `chart_replay_admin=${createAdminSession(cfg)}`;
  const saveRes = await call('sponsorship', {
    cookie: adminCookie,
    body: {
      sponsorship: {
        enabled: true,
        sponsorName: 'Exness',
        badgeText: 'Official Global Partner',
        headlinePrefix: 'Chart session powered by',
        subtext: 'Loading institutional workspace for',
        accentColor: '#10b981',
        logoLightUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        logoDarkUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    },
  });
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.body.ok, true);
  assert.equal(saveRes.body.sponsorship.sponsorName, 'Exness');
  assert.equal(sponsorshipRows.length, 1);
  assert.equal(sponsorshipRows[0].sponsor_name, 'Exness');
  assert.equal(sponsorshipRows[0].headline_prefix, 'Chart session powered by');

  // 3. Unsafe script/XSS URLs are rejected
  const xssRes = await call('sponsorship', {
    cookie: adminCookie,
    body: {
      sponsorship: {
        sponsorName: 'Bad',
        logoLightUrl: 'javascript:alert(1)',
      },
    },
  });
  assert.equal(xssRes.statusCode, 400);

  // 4. Public GET returns the saved Supabase sponsorship
  const getRes = await call('sponsorship', { method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.sponsorship.sponsorName, 'Exness');
  assert.equal(getRes.body.sponsorship.badgeText, 'Official Global Partner');
  assert.equal(getRes.body.sponsorship.enabled, true);

  // 5. Administrator can disable and re-enable sponsorship loader toggle
  const disableRes = await call('sponsorship', {
    cookie: adminCookie,
    body: {
      sponsorship: {
        ...getRes.body.sponsorship,
        enabled: false,
      },
    },
  });
  assert.equal(disableRes.statusCode, 200);
  assert.equal(disableRes.body.sponsorship.enabled, false);

  const getDisabledRes = await call('sponsorship', { method: 'GET' });
  assert.equal(getDisabledRes.statusCode, 200);
  assert.equal(getDisabledRes.body.sponsorship.enabled, false);
});

test('Newly signed-up user has 0 sessions, 0 trades, and no trading plan even if starter/demo sessions exist', async () => {
  const userRows = [];
  const sessionRows = [
    {
      id: 'session-normal-trader',
      user_email: 'info@voomay.co.za',
      name: 'XAUUSD NY Killzone Backtest',
      mode: 'BACKTESTING',
      realized_pnl: 0,
      session_data: {
        id: 'session-normal-trader',
        positions: Array.from({ length: 18 }, (_, i) => ({ id: `p-${i}` })),
        strategyName: 'ICT Silver Bullet (NY Open)',
      },
    },
    {
      id: 'session-prop-trader',
      user_email: 'info@voomay.co.za',
      name: 'FTMO $100K Phase 1 Evaluation',
      mode: 'PROP_FIRM',
      realized_pnl: 0,
      session_data: {
        id: 'session-prop-trader',
        positions: Array.from({ length: 5 }, (_, i) => ({ id: `pp-${i}` })),
        strategyName: 'SMC Orderblock + FVG',
      },
    },
  ];
  const adminEmail = 'admin@chartreplay.local';
  const adminHash = await hashPassword('AdminSecretPassword-2026');
  const envWithAdmin = {
    ...SUPABASE_ENV,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD_HASH: adminHash,
    ADMIN_SESSION_SECRET: 'test-new-user-zero-session-secret',
  };

  const mockRequest = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (url.includes('platform_users')) {
      if (method === 'GET') {
        return { ok: true, status: 200, text: async () => JSON.stringify(userRows) };
      }
      if (method === 'POST') {
        const incoming = JSON.parse(options.body);
        for (const item of Array.isArray(incoming) ? incoming : [incoming]) {
          userRows.push(item);
        }
        return { ok: true, status: 201, text: async () => '' };
      }
    }
    if (url.includes('trading_sessions') && method === 'GET') {
      return { ok: true, status: 200, text: async () => JSON.stringify(sessionRows) };
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const store = createSupabaseAccountStore({
    env: envWithAdmin,
    request: mockRequest,
  });
  const handler = createPlatformHandler({ store });

  const call = async (action, { method = 'POST', body = {}, cookie = '' } = {}) => {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(v) {
        this.body = JSON.parse(v);
      },
    };
    await handler(
      {
        url: `/?action=${action}`,
        method,
        body,
        headers: {
          host: 'app.chartreplay.co.za',
          origin: 'https://app.chartreplay.co.za',
          cookie,
          'content-type': 'application/json',
        },
        socket: { remoteAddress: '127.0.0.1' },
      },
      res
    );
    return res;
  };

  await call('register', {
    body: {
      name: 'Brandon',
      email: 'info@voomay.co.za',
      password: 'BrandonPassword#2026',
    },
  });

  const cfg = await store.config();
  const adminCookie = `chart_replay_admin=${createAdminSession(cfg)}`;
  const usersRes = await call('users', { method: 'GET', cookie: adminCookie });
  assert.equal(usersRes.statusCode, 200);
  const brandon = usersRes.body.users.find((u) => u.email === 'info@voomay.co.za');
  assert.ok(brandon);
  assert.equal(brandon.sessionCount, 0);
  assert.equal(brandon.tradeCount, 0);
  assert.equal(brandon.hasTradingPlan, false);
  assert.equal(brandon.tradingPlanName, null);
});

test('User signs up, creates a session, creates their own trading plan, trades 3 trades, and Administrator sees signup & trading plan', async () => {
  const userRows = [];
  const sessionRows = [];
  const strategyRows = [];
  const noteRows = [];
  const adminEmail = 'admin@chartreplay.local';
  const adminPassword = 'AdminSecretPassword-2026';
  const adminHash = await hashPassword(adminPassword);
  const envWithAdmin = {
    ...SUPABASE_ENV,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD_HASH: adminHash,
    ADMIN_SESSION_SECRET: 'test-e2e-admin-session-secret',
  };

  const mockRequest = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (url.includes('platform_users')) {
      if (method === 'GET') {
        return { ok: true, status: 200, text: async () => JSON.stringify(userRows) };
      }
      if (method === 'POST') {
        const incoming = JSON.parse(options.body);
        for (const item of Array.isArray(incoming) ? incoming : [incoming]) {
          const idx = userRows.findIndex((r) => r.email === item.email);
          if (idx >= 0) userRows[idx] = { ...userRows[idx], ...item };
          else userRows.push(item);
        }
        return { ok: true, status: 201, text: async () => '' };
      }
    }
    if (url.includes('trading_sessions')) {
      if (method === 'GET') {
        return { ok: true, status: 200, text: async () => JSON.stringify(sessionRows) };
      }
    }
    if (url.includes('user_strategies')) {
      if (method === 'GET') {
        return { ok: true, status: 200, text: async () => JSON.stringify(strategyRows) };
      }
    }
    if (url.includes('user_strategy_notes')) {
      if (method === 'GET') {
        return { ok: true, status: 200, text: async () => JSON.stringify(noteRows) };
      }
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const store = createSupabaseAccountStore({
    env: envWithAdmin,
    request: mockRequest,
  });
  const handler = createPlatformHandler({ store });

  const call = async (action, { method = 'POST', body = {}, cookie = '' } = {}) => {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(v) {
        this.body = JSON.parse(v);
      },
    };
    await handler(
      {
        url: `/?action=${action}`,
        method,
        body,
        headers: {
          host: 'app.chartreplay.co.za',
          origin: 'https://app.chartreplay.co.za',
          cookie,
          'content-type': 'application/json',
        },
        socket: { remoteAddress: '127.0.0.1' },
      },
      res
    );
    return res;
  };

  // 1. User signs up
  const signupRes = await call('register', {
    body: {
      name: 'Kagiso Mbeki',
      email: 'kagiso.mbeki@chartreplay.co.za',
      password: 'KagisoTrader#2026',
    },
  });
  assert.equal(signupRes.statusCode, 201);
  assert.equal(signupRes.body.user.email, 'kagiso.mbeki@chartreplay.co.za');

  // 2. User creates their own trading plan (strategy + notes) and a trading session with 3 trades
  strategyRows.push({
    id: 'strat-custom-kagiso-gold-plan',
    user_email: 'kagiso.mbeki@chartreplay.co.za',
    name: 'NY Killzone Gold Sweep & FVG Plan',
    description: 'Wait for 13:30 UTC NY open sweep on XAUUSD, enter 5m FVG with 1:2.5 R:R.',
  });
  noteRows.push({
    user_email: 'kagiso.mbeki@chartreplay.co.za',
    notes_text: 'MY TRADING PLAN — NY KILLZONE GOLD\n• Max 2 trades per day\n• 0.75% risk per trade',
    updated_at: new Date().toISOString(),
  });
  sessionRows.push({
    id: 'session-kagiso-ny-gold-01',
    user_email: 'kagiso.mbeki@chartreplay.co.za',
    name: 'XAUUSD NY Open Execution Session',
    mode: 'BACKTESTING',
    realized_pnl: 4250.5,
    session_data: {
      id: 'session-kagiso-ny-gold-01',
      name: 'XAUUSD NY Open Execution Session',
      strategyName: 'NY Killzone Gold Sweep & FVG Plan',
      mindsetNote: {
        text: 'MY TRADING PLAN — NY KILLZONE GOLD\n• Max 2 trades per day\n• 0.75% risk per trade',
        pinned: true,
      },
      positions: [
        { id: 'pos-1', symbol: 'XAUUSD', side: 'LONG', pnl: 1850.0, status: 'CLOSED_TP' },
        { id: 'pos-2', symbol: 'EURUSD', side: 'SHORT', pnl: -650.0, status: 'CLOSED_SL' },
        { id: 'pos-3', symbol: 'XAUUSD', side: 'LONG', pnl: 3050.5, status: 'CLOSED_TP' },
      ],
    },
  });

  // 3. Administrator logs in
  const adminLoginRes = await call('admin-login', {
    body: {
      email: adminEmail,
      password: adminPassword,
    },
  });
  assert.equal(adminLoginRes.statusCode, 200);
  const adminCookie = adminLoginRes.headers['Set-Cookie'].split(';')[0];

  // 4. Administrator fetches users and sees signup, trading plan, session, and trades
  const usersRes = await call('users', {
    method: 'GET',
    cookie: adminCookie,
  });
  assert.equal(usersRes.statusCode, 200);
  assert.equal(usersRes.body.scope, 'supabase');
  assert.equal(usersRes.body.users.length, 1);
  const recordedUser = usersRes.body.users[0];
  assert.equal(recordedUser.name, 'Kagiso Mbeki');
  assert.equal(recordedUser.email, 'kagiso.mbeki@chartreplay.co.za');
  assert.equal(recordedUser.hasTradingPlan, true);
  assert.equal(recordedUser.tradingPlanName, 'NY Killzone Gold Sweep & FVG Plan');
  assert.equal(recordedUser.sessionCount, 1);
  assert.equal(recordedUser.tradeCount, 3);
});

test('Resend integration sends welcome email on signup and completes signed password reset link flow', async () => {
  const userRows = [];
  const sentEmails = [];
  const envWithResend = {
    ...SUPABASE_ENV,
    RESEND_ENABLED: 'true',
    RESEND_API_KEY: 're_test_key_12345',
    RESEND_FROM_EMAIL: 'Chart Replay <noreply@chartreplay.co.za>',
    RESEND_REPLY_TO: 'info@chartreplay.co.za',
    ADMIN_SESSION_SECRET: 'test-resend-session-secret-2026',
  };

  const mockRequest = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (String(url).includes('api.resend.com/emails')) {
      const payload = JSON.parse(options.body);
      sentEmails.push({
        authHeader: options.headers?.Authorization,
        payload,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `email_${sentEmails.length}` }),
      };
    }
    if (String(url).includes('platform_users')) {
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(userRows),
        };
      }
      if (method === 'POST') {
        const incoming = JSON.parse(options.body);
        for (const item of Array.isArray(incoming) ? incoming : [incoming]) {
          const idx = userRows.findIndex((r) => r.email === item.email);
          if (idx >= 0) userRows[idx] = { ...userRows[idx], ...item };
          else userRows.push(item);
        }
        return { ok: true, status: 201, text: async () => '' };
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(options.body);
        const idMatch = String(url).match(/id=eq\.([^&]+)/);
        const targetId = idMatch ? decodeURIComponent(idMatch[1]) : null;
        const idx = userRows.findIndex((r) => r.id === targetId);
        if (idx >= 0) {
          userRows[idx] = { ...userRows[idx], ...patch };
        }
        return { ok: true, status: 204, text: async () => '' };
      }
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };

  let currentNow = Date.UTC(2026, 9, 28, 14, 0, 0);
  const store = createSupabaseAccountStore({
    env: envWithResend,
    request: mockRequest,
  });
  const handler = createPlatformHandler({
    store,
    now: () => currentNow,
    env: envWithResend,
    request: mockRequest,
  });

  const call = async (action, { method = 'POST', body = {}, cookie = '' } = {}) => {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(v) {
        this.body = JSON.parse(v);
      },
    };
    await handler(
      {
        url: `/?action=${action}`,
        method,
        body,
        headers: {
          host: 'chartflow-preview.vercel.app',
          origin: 'https://chartflow-preview.vercel.app',
          cookie,
          'content-type': 'application/json',
        },
        socket: { remoteAddress: '127.0.0.1' },
      },
      res
    );
    return res;
  };

  // 1. User registers -> Welcome email is sent via Resend
  const regRes = await call('register', {
    body: {
      name: 'Naledi Khumalo',
      email: 'naledi@chartreplay.co.za',
      password: 'OldPassword#123',
    },
  });
  assert.equal(regRes.statusCode, 201);
  assert.equal(regRes.body.welcomeEmailSent, true);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].authHeader, 'Bearer re_test_key_12345');
  assert.equal(sentEmails[0].payload.from, 'Chart Replay <noreply@chartreplay.co.za>');
  assert.deepEqual(sentEmails[0].payload.to, ['naledi@chartreplay.co.za']);
  assert.match(sentEmails[0].payload.subject, /Welcome to Chart Replay/);
  assert.match(sentEmails[0].payload.html, /Welcome aboard, Naledi Khumalo!/);
  assert.match(sentEmails[0].payload.html, /https:\/\/chartreplay\.co\.za\/email-welcome-banner\.png/);
  assert.doesNotMatch(sentEmails[0].payload.html, /vercel\.app/);
  assert.match(sentEmails[0].payload.html, /5 Benefits of Practicing on Chart Replay/);

  // 2. User requests password reset -> Reset link email is sent via Resend
  const reqResetRes = await call('request-password-reset', {
    body: { email: 'naledi@chartreplay.co.za' },
  });
  assert.equal(reqResetRes.statusCode, 200);
  assert.equal(reqResetRes.body.ok, true);
  assert.equal(sentEmails.length, 2);
  assert.deepEqual(sentEmails[1].payload.to, ['naledi@chartreplay.co.za']);
  assert.match(sentEmails[1].payload.subject, /Reset your Chart Replay password/);
  assert.doesNotMatch(sentEmails[1].payload.html, /vercel\.app/);
  assert.match(sentEmails[1].payload.html, /https:\/\/chartreplay\.co\.za\/\?reset_token=/);

  // Extract reset_token from email text
  const tokenMatch = sentEmails[1].payload.text.match(/reset_token=([^&\s]+)/);
  assert.ok(tokenMatch, 'Expected reset_token in password reset email');
  const resetToken = decodeURIComponent(tokenMatch[1]);

  // 3. Complete password reset using the token from the email
  const completeRes = await call('reset-password', {
    body: {
      token: resetToken,
      password: 'NewStrongPassword#456',
    },
  });
  assert.equal(completeRes.statusCode, 200);
  assert.equal(completeRes.body.ok, true);
  assert.equal(completeRes.body.user.email, 'naledi@chartreplay.co.za');

  // 4. Reusing the same reset token a second time is rejected (single-use)
  const reuseRes = await call('reset-password', {
    body: {
      token: resetToken,
      password: 'AnotherPassword#789',
    },
  });
  assert.equal(reuseRes.statusCode, 400);
  assert.match(reuseRes.body.error, /already been used|no longer valid/i);

  // 5. Old password no longer works, new password succeeds
  const oldLogin = await call('login', {
    body: {
      email: 'naledi@chartreplay.co.za',
      password: 'OldPassword#123',
    },
  });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await call('login', {
    body: {
      email: 'naledi@chartreplay.co.za',
      password: 'NewStrongPassword#456',
    },
  });
  assert.equal(newLogin.statusCode, 200);
  assert.equal(newLogin.body.user.email, 'naledi@chartreplay.co.za');
});

