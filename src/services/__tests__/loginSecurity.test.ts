import { describe, expect, it, beforeEach } from 'vitest';
import {
  authenticateUserAccount,
  clearClientLoginLockout,
  getLoginLockoutStatus,
  hasSqlInjectionPattern,
  isSafeEmailFormat,
  LOGIN_LOCKOUT_DURATION_MS,
  LOGIN_MAX_ATTEMPTS,
  registerUserAccount,
} from '../storageAndAnalytics';
// @ts-expect-error ESM server module
import { createPlatformHandler, hashPassword } from '../../../server/platformAccounts.mjs';

function makeMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let rawBody = '';
  return {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(payload = '') {
      rawBody = String(payload);
    },
    json() {
      return rawBody ? JSON.parse(rawBody) : null;
    },
    headers,
  };
}

describe('Brute-Force 3-Strike 30-Second Lockout & SQL Injection Protection', () => {
  beforeEach(() => {
    clearClientLoginLockout('locktest@chartreplay.co.za');
    clearClientLoginLockout('trader@chartflow.io');
  });

  it('detects SQL injection and PostgREST injection payloads accurately', () => {
    expect(hasSqlInjectionPattern("' OR 1=1 --")).toBe(true);
    expect(hasSqlInjectionPattern("admin'--")).toBe(true);
    expect(hasSqlInjectionPattern('"; DROP TABLE platform_users; --')).toBe(true);
    expect(hasSqlInjectionPattern('1 UNION SELECT email, password_hash FROM platform_users')).toBe(
      true
    );
    expect(hasSqlInjectionPattern("test@example.com' OR 'a'='a")).toBe(true);
    expect(hasSqlInjectionPattern('normal.trader@chartreplay.co.za')).toBe(false);
    expect(hasSqlInjectionPattern('MyStrongP@ssw0rd!2026')).toBe(false);

    expect(isSafeEmailFormat('trader@chartreplay.co.za')).toBe(true);
    expect(isSafeEmailFormat("admin'@chartreplay.co.za")).toBe(false);
    expect(isSafeEmailFormat('user@chartreplay.co.za; DROP TABLE users')).toBe(false);
  });

  it('locks out client login for 30 seconds after 3 failed attempts and unlocks after 30s', () => {
    const email = 'locktest@chartreplay.co.za';
    registerUserAccount('Lock Tester', email, 'CorrectPass123');
    clearClientLoginLockout(email);

    const t0 = 1_700_000_000_000;

    // Attempt 1 (fail)
    const r1 = authenticateUserAccount(email, 'WrongPass1', t0);
    expect(r1.ok).toBe(false);
    expect(r1.lockedOut).toBe(false);
    expect(r1.remainingAttempts).toBe(2);

    // Attempt 2 (fail)
    const r2 = authenticateUserAccount(email, 'WrongPass2', t0 + 1000);
    expect(r2.ok).toBe(false);
    expect(r2.lockedOut).toBe(false);
    expect(r2.remainingAttempts).toBe(1);

    // Attempt 3 (fail -> triggers 30-second lockout)
    const r3 = authenticateUserAccount(email, 'WrongPass3', t0 + 2000);
    expect(r3.ok).toBe(false);
    expect(r3.lockedOut).toBe(true);
    expect(r3.remainingAttempts).toBe(0);
    expect(r3.retryAfterSeconds).toBe(30);
    expect(r3.lockedUntil).toBe(t0 + 2000 + LOGIN_LOCKOUT_DURATION_MS);

    // Attempt during 30s lockout (even with correct password) is rejected with remaining seconds
    const duringLock = authenticateUserAccount(email, 'CorrectPass123', t0 + 12_000);
    expect(duringLock.ok).toBe(false);
    expect(duringLock.lockedOut).toBe(true);
    expect(duringLock.retryAfterSeconds).toBe(20);

    const statusAt20s = getLoginLockoutStatus(email, t0 + 22_000);
    expect(statusAt20s.locked).toBe(true);
    expect(statusAt20s.retryAfterSeconds).toBe(10);

    // After 30 seconds have elapsed, lockout expires and valid login succeeds
    const afterLock = authenticateUserAccount(
      email,
      'CorrectPass123',
      t0 + 2000 + LOGIN_LOCKOUT_DURATION_MS + 100
    );
    expect(afterLock.ok).toBe(true);
    expect(afterLock.user?.email).toBe(email);
    expect(LOGIN_MAX_ATTEMPTS).toBe(3);
    expect(LOGIN_LOCKOUT_DURATION_MS).toBe(30_000);
  });

  it('enforces 3-strike 30-second lockout and SQL injection rejection on server /api/platform login', async () => {
    let fakeNow = 1_700_000_000_000;
    const validHash = await hashPassword('ValidPass999');
    const users = [
      {
        id: 'u-1',
        name: 'Server Trader',
        email: 'servertrader@chartreplay.co.za',
        passwordHash: validHash,
        joinedAt: new Date(fakeNow).toISOString(),
        loginCount: 1,
        lastLoginAt: new Date(fakeNow).toISOString(),
      },
    ];
    const mockStore = {
      remote: true,
      async config() {
        return {
          email: 'admin@chartreplay.co.za',
          passwordHash: validHash,
          sessionSecret: 'test-session-secret-key-32-bytes-long',
          userAuthEnabled: true,
        };
      },
      async findByEmail(email: string) {
        return users.find((u) => u.email === email) || null;
      },
      async recordLogin(user: (typeof users)[0], nowIso: string) {
        user.loginCount += 1;
        user.lastLoginAt = nowIso;
        return user;
      },
    };

    const handler = createPlatformHandler({
      store: mockStore,
      now: () => fakeNow,
      env: {},
    });

    const postLogin = async (email: string, password: string) => {
      const req = {
        method: 'POST',
        url: '/api/platform?action=login',
        headers: {
          host: 'localhost:3007',
          origin: 'http://localhost:3007',
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.50',
        },
        body: JSON.stringify({ email, password }),
        socket: { remoteAddress: '203.0.113.50' },
      };
      const res = makeMockRes();
      await handler(req, res);
      return { status: res.statusCode, data: res.json(), headers: res.headers };
    };

    // 1st failed attempt -> 401 with 2 attempts remaining
    const a1 = await postLogin('servertrader@chartreplay.co.za', 'wrong1');
    expect(a1.status).toBe(401);
    expect(a1.data.remainingAttempts).toBe(2);

    // 2nd failed attempt (SQL injection attempt) -> 400 with 1 attempt remaining
    const a2 = await postLogin("servertrader@chartreplay.co.za' OR 1=1 --", 'wrong2');
    expect(a2.status).toBe(400);
    expect(a2.data.remainingAttempts).toBe(1);

    // 3rd failed attempt -> 429 locked out for 30 seconds
    const a3 = await postLogin('servertrader@chartreplay.co.za', 'wrong3');
    expect(a3.status).toBe(429);
    expect(a3.data.lockedOut).toBe(true);
    expect(a3.data.retryAfterSeconds).toBe(30);
    expect(a3.headers['retry-after']).toBe('30');

    // Attempt 15 seconds later -> still locked with 15s remaining
    fakeNow += 15_000;
    const during = await postLogin('servertrader@chartreplay.co.za', 'ValidPass999');
    expect(during.status).toBe(429);
    expect(during.data.lockedOut).toBe(true);
    expect(during.data.retryAfterSeconds).toBe(15);

    // Attempt after 30 seconds -> lockout lifted, valid password succeeds
    fakeNow += 16_000;
    const after = await postLogin('servertrader@chartreplay.co.za', 'ValidPass999');
    expect(after.status).toBe(200);
    expect(after.data.user.email).toBe('servertrader@chartreplay.co.za');
  });
});
