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
