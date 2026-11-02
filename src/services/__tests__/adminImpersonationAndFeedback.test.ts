import { describe, expect, it } from 'vitest';
// @ts-expect-error Node server module has no .d.ts
import { createAdminSession, createPlatformHandler, hashPassword } from '../../../server/platformAccounts.mjs';
// @ts-expect-error Node server module has no .d.ts
import { buildFirstTradeFeedbackEmail, buildContactInquiryEmail, CONTACT_INQUIRY_RECIPIENT, PERSONAL_CONTACT_EMAIL } from '../../../server/resendMail.mjs';
import {
  hasSeenExperiencePopup,
  markExperiencePopupSeen,
} from '../../components/ExperienceReviewPopup';

function createInMemoryTestStore(adminConfig: {
  email: string;
  passwordHash: string;
  sessionSecret: string;
}) {
  const users: any[] = [
    {
      id: 'user-trader-1',
      name: 'Sipho Ndlovu',
      email: 'sipho@example.com',
      passwordHash: 'scrypt:abc:def',
      joinedAt: '2026-10-20T08:00:00.000Z',
      loginCount: 3,
      lastLoginAt: '2026-10-25T10:00:00.000Z',
      sessionCount: 2,
      tradeCount: 4,
      hasTradingPlan: true,
      tradingPlanName: 'London Breakout Plan',
    },
  ];
  const feedback: any[] = [];
  const emailLogs: any[] = [];
  const contactInquiries: any[] = [];

  return {
    remote: true,
    async config() {
      return { ...adminConfig, userAuthEnabled: true };
    },
    async read() {
      return users;
    },
    async findById(id: string) {
      return users.find((u) => u.id === id) || null;
    },
    async findByEmail(email: string) {
      return (
        users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
      );
    },
    async change(op: (list: any[]) => any) {
      return op(users);
    },
    async readFeedback() {
      return feedback;
    },
    async saveFeedback(entry: any) {
      feedback.unshift(entry);
      return entry;
    },
    async readFeedbackEmails() {
      return emailLogs;
    },
    async recordFeedbackEmail(entry: any) {
      emailLogs.unshift(entry);
      return entry;
    },
    async readContactInquiries() {
      return contactInquiries;
    },
    async saveContactInquiry(entry: any) {
      contactInquiries.unshift(entry);
      return entry;
    },
  };
}

async function callHandler(
  handler: any,
  {
    method = 'GET',
    action,
    body,
    cookie = '',
  }: {
    method?: 'GET' | 'POST';
    action: string;
    body?: any;
    cookie?: string;
  }
) {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  let rawBody = '';

  const req: any = {
    method,
    url: `/api/platform?action=${encodeURIComponent(action)}`,
    headers: {
      host: 'localhost:3007',
      origin: 'http://localhost:3007',
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    socket: { remoteAddress: '127.0.0.1' },
  };

  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    end(payload: string) {
      rawBody = payload;
    },
  };

  await handler(req, res);
  return {
    status: statusCode,
    headers,
    data: rawBody ? JSON.parse(rawBody) : null,
  };
}

describe('Administrator user impersonation & trader feedback system', () => {
  it('blocks non-administrators from logging into a user account and allows the authenticated administrator without incrementing user loginCount', async () => {
    const adminConfig = {
      email: 'admin@chartreplay.co.za',
      passwordHash: await hashPassword('admin-secret-pass'),
      sessionSecret: 'test-session-secret-key-123456',
    };
    const store = createInMemoryTestStore(adminConfig);
    const handler = createPlatformHandler({ store });

    // 1. Unauthenticated request is rejected with 401
    const unauth = await callHandler(handler, {
      method: 'POST',
      action: 'admin-impersonate',
      body: { userId: 'user-trader-1', email: 'sipho@example.com' },
    });
    expect(unauth.status).toBe(401);

    // 2. Authenticated administrator can log into Sipho's account
    const adminToken = createAdminSession(adminConfig, Date.now());
    const authRes = await callHandler(handler, {
      method: 'POST',
      action: 'admin-impersonate',
      cookie: `chart_replay_admin=${adminToken}`,
      body: { userId: 'user-trader-1', email: 'sipho@example.com' },
    });
    expect(authRes.status).toBe(200);
    expect(authRes.data.ok).toBe(true);
    expect(authRes.data.user.email).toBe('sipho@example.com');
    expect(authRes.data.user.name).toBe('Sipho Ndlovu');
    // Login count remains 3 (admin inspection does not inflate user login counts)
    expect(authRes.data.user.loginCount).toBe(3);
    expect(authRes.headers['set-cookie']).toContain('chart_replay_user=');
  });

  it('builds the first-trade feedback email with the trader message and feedback link', () => {
    const emailContent = buildFirstTradeFeedbackEmail({
      name: 'Sipho Ndlovu',
      email: 'sipho@example.com',
      appUrl: 'https://chartreplay.co.za',
    });
    expect(emailContent.subject).toContain('We saw you placed your first trade');
    expect(emailContent.html).toContain('How did you find our platform? Is it user-friendly?');
    expect(emailContent.html).toContain(
      'Let us know if we can improve it and where we can improve it.'
    );
    expect(emailContent.html).toContain('Your feedback is valuable.');
    expect(emailContent.html).toContain('User Friendliness');
    expect(emailContent.html).toContain('Charts &amp; Tools');
    expect(emailContent.html).toContain('Smoothness &amp; Speed');
    expect(emailContent.feedbackUrl).toContain('feedback=1');
    expect(emailContent.feedbackUrl).toContain('sipho%40example.com');
  });

  it('saves trader 1-5 star ratings (User Friendliness, Charts, Smoothness) and improvement feedback and returns them to the administrator', async () => {
    const adminConfig = {
      email: 'admin@chartreplay.co.za',
      passwordHash: await hashPassword('admin-secret-pass'),
      sessionSecret: 'test-session-secret-key-123456',
    };
    const store = createInMemoryTestStore(adminConfig);
    const handler = createPlatformHandler({ store });
    const adminCookie = `chart_replay_admin=${createAdminSession(
      adminConfig,
      Date.now()
    )}`;

    // 1. Admin sends feedback email to Sipho
    const sendEmailRes = await callHandler(handler, {
      method: 'POST',
      action: 'send-feedback-email',
      cookie: adminCookie,
      body: {
        recipients: [{ email: 'sipho@example.com', name: 'Sipho Ndlovu' }],
      },
    });
    expect(sendEmailRes.status).toBe(200);
    expect(sendEmailRes.data.ok).toBe(true);
    expect(sendEmailRes.data.results[0].feedbackUrl).toContain('feedback=1');

    // 2. Trader submits 3 star ratings (5, 4, 5) and written feedback
    const submitRes = await callHandler(handler, {
      method: 'POST',
      action: 'submit-feedback',
      body: {
        name: 'Sipho Ndlovu',
        email: 'sipho@example.com',
        ratingUserFriendliness: 5,
        ratingCharts: 4,
        ratingSmoothness: 5,
        improvementsText:
          'Very user friendly! Would love more shortcut keys for drawing tools.',
      },
    });
    expect(submitRes.status).toBe(201);
    expect(submitRes.data.ok).toBe(true);
    expect(submitRes.data.feedback.ratingUserFriendliness).toBe(5);
    expect(submitRes.data.feedback.ratingCharts).toBe(4);
    expect(submitRes.data.feedback.ratingSmoothness).toBe(5);
    expect(submitRes.data.feedback.overallRating).toBe(4.67);

    // 3. Admin reads feedback and email logs on the Administrator Dashboard
    const adminReadRes = await callHandler(handler, {
      method: 'GET',
      action: 'feedback',
      cookie: adminCookie,
    });
    expect(adminReadRes.status).toBe(200);
    expect(adminReadRes.data.feedback).toHaveLength(1);
    expect(adminReadRes.data.feedback[0].improvementsText).toContain(
      'shortcut keys for drawing tools'
    );
    expect(adminReadRes.data.emailLogs).toHaveLength(1);
    expect(adminReadRes.data.emailLogs[0].userEmail).toBe('sipho@example.com');
  });

  it('saves Contact Us inquiries across all 4 categories (general_inquiry, partnership, improvement, bug), routes email to info@voomay.co.za, and exposes them to the administrator backend', async () => {
    expect(CONTACT_INQUIRY_RECIPIENT).toBe('info@voomay.co.za');
    expect(PERSONAL_CONTACT_EMAIL).toBe('cheslin@voomay.co.za');

    const adminConfig = {
      email: 'admin@chartreplay.co.za',
      passwordHash: await hashPassword('admin-secret-pass'),
      sessionSecret: 'test-session-secret-key-123456',
    };
    const store = createInMemoryTestStore(adminConfig);
    const handler = createPlatformHandler({ store });
    const adminCookie = `chart_replay_admin=${createAdminSession(
      adminConfig,
      Date.now()
    )}`;

    const categories = [
      'general_inquiry',
      'partnership',
      'improvement',
      'bug',
    ] as const;

    for (const category of categories) {
      const res = await callHandler(handler, {
        method: 'POST',
        action: 'submit-contact',
        body: {
          name: 'Thabo Nkosi',
          email: 'thabo@example.com',
          category,
          subject: `Test ${category}`,
          message: `Hello team, this is a ${category} message for Chart Replay.`,
        },
      });
      expect(res.status).toBe(201);
      expect(res.data.ok).toBe(true);
      expect(res.data.recipientEmail).toBe('info@voomay.co.za');
      expect(res.data.inquiry.category).toBe(category);
      expect(res.data.inquiry.recipientEmail).toBe('info@voomay.co.za');
    }

    const builtEmail = buildContactInquiryEmail({
      name: 'Thabo Nkosi',
      email: 'thabo@example.com',
      category: 'partnership',
      subject: 'Academy Partnership',
      message: 'We would love to partner with Chart Replay.',
    });
    expect(builtEmail.subject).toContain('Partnership Opportunity');
    expect(builtEmail.html).toContain('info@voomay.co.za');
    expect(builtEmail.html).toContain('thabo@example.com');

    // Administrator sees all 4 inquiries in the backend
    const adminReadRes = await callHandler(handler, {
      method: 'GET',
      action: 'feedback',
      cookie: adminCookie,
    });
    expect(adminReadRes.status).toBe(200);
    expect(adminReadRes.data.contactInquiries).toHaveLength(4);
    expect(
      adminReadRes.data.contactInquiries.map((i: any) => i.category)
    ).toEqual(['bug', 'improvement', 'partnership', 'general_inquiry']);
  });

  it('tracks the one-time experience review popup so it triggers only once', () => {
    expect(hasSeenExperiencePopup('sipho@example.com')).toBe(false);
    markExperiencePopupSeen('sipho@example.com');
    expect(hasSeenExperiencePopup('sipho@example.com')).toBe(true);
    expect(hasSeenExperiencePopup()).toBe(true);
  });
});
