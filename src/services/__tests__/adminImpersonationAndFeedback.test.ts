import { describe, expect, it } from 'vitest';
// @ts-expect-error Node server module has no .d.ts
import { createAdminSession, createPlatformHandler, hashPassword } from '../../../server/platformAccounts.mjs';
// @ts-expect-error Node server module has no .d.ts
import { buildFirstTradeFeedbackEmail, buildFeedbackNotificationEmail, buildContactInquiryEmail, buildPersonalizedNewsletterEmail, sendFeedbackNotificationEmail, sendContactInquiryEmail, sendResendEmail, resolveResendConfig, DEFAULT_NEWSLETTER_TEMPLATES, CONTACT_INQUIRY_RECIPIENT, PERSONAL_CONTACT_EMAIL } from '../../../server/resendMail.mjs';
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
  let newsletters: any[] = [];
  const newsletterLogs: any[] = [];

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
    async readNewsletters() {
      return newsletters;
    },
    async saveNewsletters(items: any[]) {
      newsletters = Array.isArray(items) ? items : [];
      return newsletters;
    },
    async readNewsletterLogs() {
      return newsletterLogs;
    },
    async recordNewsletterLog(entry: any) {
      const idx = newsletterLogs.findIndex((item) => item.id === entry.id);
      if (idx >= 0) {
        newsletterLogs[idx] = { ...newsletterLogs[idx], ...entry };
      } else {
        newsletterLogs.unshift(entry);
      }
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
    const handler = createPlatformHandler({ store, env: {} });

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
    const handler = createPlatformHandler({ store, env: {} });
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
    const handler = createPlatformHandler({ store, env: {} });
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

  it('exposes user login timestamps and time-on-platform duration only to the authenticated administrator', async () => {
    const adminConfig = {
      email: 'admin@chartreplay.co.za',
      passwordHash: await hashPassword('admin-secret-pass'),
      sessionSecret: 'test-session-secret-key-123456',
    };
    const store = createInMemoryTestStore(adminConfig);
    const handler = createPlatformHandler({ store, env: {} });
    const adminCookie = `chart_replay_admin=${createAdminSession(
      adminConfig,
      Date.now()
    )}`;

    // 1. Regular user impersonation / status does not expose admin-only duration fields
    const impRes = await callHandler(handler, {
      method: 'POST',
      action: 'admin-impersonate',
      cookie: adminCookie,
      body: { userId: 'user-trader-1', email: 'sipho@example.com' },
    });
    expect(impRes.status).toBe(200);
    expect(impRes.data.user.totalTimeOnPlatformSeconds).toBeUndefined();

    // 2. Administrator users endpoint includes login timestamp and platform duration metrics
    const usersRes = await callHandler(handler, {
      method: 'GET',
      action: 'users',
      cookie: adminCookie,
    });
    expect(usersRes.status).toBe(200);
    const adminViewUser = usersRes.data.users[0];
    expect(adminViewUser.lastLoginAt).toBe('2026-10-25T10:00:00.000Z');
    expect(typeof adminViewUser.currentSessionSeconds).toBe('number');
    expect(adminViewUser.currentSessionSeconds).toBeGreaterThan(0);
    expect(typeof adminViewUser.totalTimeOnPlatformSeconds).toBe('number');
    expect(adminViewUser.totalTimeOnPlatformSeconds).toBeGreaterThan(0);
    expect(typeof adminViewUser.platformMemberDurationSeconds).toBe('number');
    expect(adminViewUser.platformMemberDurationSeconds).toBeGreaterThan(0);
  });

  it('personalizes 3-to-5-step trader playbooks without Personal Trader Snapshot or Day 1 labels, supports bulk & 2-3+ day inactive sends, and tracks email opens/clicks', async () => {
    expect(DEFAULT_NEWSLETTER_TEMPLATES.length).toBeGreaterThanOrEqual(8);

    const sampleRecipient = {
      name: 'Sipho Ndlovu',
      email: 'sipho@example.com',
      joinedAt: '2026-10-20T08:00:00.000Z',
      sessionCount: 5,
      tradeCount: 11,
      hasTradingPlan: true,
      tradingPlanName: 'London Breakout Plan',
    };

    const personalized = buildPersonalizedNewsletterEmail({
      newsletter: DEFAULT_NEWSLETTER_TEMPLATES[0],
      recipient: sampleRecipient,
      trackingId: 'nl-log-test-123',
    });
    expect(personalized.subject).toContain('Sipho');
    expect(personalized.subject).toContain('5 Steps How to Pass a Prop Firm');
    expect(personalized.headline).toContain('Sipho');
    expect(personalized.badgeText).not.toMatch(/Day\s+\d+/i);
    expect(personalized.badgeText).not.toContain('Daily Trader Motivation');
    expect(personalized.html).toContain('London Breakout Plan');
    expect(personalized.html).toContain('5-Step Trader Playbook');
    expect(personalized.html).toContain('background-color:#ffffff');
    expect(personalized.html).toContain('Cheslin from Chart Replay');
    expect(personalized.html).not.toContain('Personal Trader Snapshot');
    expect(personalized.text).not.toContain('Personal Trader Snapshot');
    expect(personalized.introParagraphs.length).toBeGreaterThanOrEqual(2);
    expect(personalized.introParagraphs.join(' ')).not.toContain('1. Protect Your Daily Drawdown');
    expect(personalized.steps).toHaveLength(5);
    expect(personalized.openTrackingUrl).toContain('action=newsletter-open');
    expect(personalized.openTrackingUrl).toContain('nl-log-test-123');
    expect(personalized.clickTrackingUrl).toContain('action=newsletter-click');

    const adminConfig = {
      email: 'admin@chartreplay.co.za',
      passwordHash: await hashPassword('admin-secret-pass'),
      sessionSecret: 'test-session-secret-key-123456',
    };
    const store = createInMemoryTestStore(adminConfig);
    const handler = createPlatformHandler({ store, env: {} });
    const adminCookie = `chart_replay_admin=${createAdminSession(
      adminConfig,
      Date.now()
    )}`;

    // 1. Load newsletters in Admin Dashboard
    const getRes = await callHandler(handler, {
      method: 'GET',
      action: 'newsletters',
      cookie: adminCookie,
    });
    expect(getRes.status).toBe(200);
    expect(getRes.data.newsletters.length).toBeGreaterThanOrEqual(8);
    expect(getRes.data.newsletters[0].approved).toBe(false);

    // 2. Attempting to schedule without approval fails with 400
    const unapprovedSchedule = await callHandler(handler, {
      method: 'POST',
      action: 'schedule-newsletter',
      cookie: adminCookie,
      body: {
        id: 'newsletter-day-1',
        scheduledFor: '2026-11-05T07:00:00.000Z',
        cadence: 'daily',
      },
    });
    expect(unapprovedSchedule.status).toBe(400);

    // 3. Administrator approves playbook newsletter
    const approveRes = await callHandler(handler, {
      method: 'POST',
      action: 'approve-newsletter',
      cookie: adminCookie,
      body: { id: 'newsletter-day-1', approved: true },
    });
    expect(approveRes.status).toBe(200);
    expect(approveRes.data.newsletter.approved).toBe(true);
    expect(approveRes.data.newsletter.approvedBy).toBe('admin@chartreplay.co.za');

    // 4. Administrator schedules approved playbook newsletter
    const scheduleRes = await callHandler(handler, {
      method: 'POST',
      action: 'schedule-newsletter',
      cookie: adminCookie,
      body: {
        id: 'newsletter-day-1',
        scheduledFor: '2026-11-05T07:00:00.000Z',
        cadence: 'daily',
        targetAudience: 'all',
      },
    });
    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.data.newsletter.status).toBe('scheduled');
    expect(scheduleRes.data.newsletter.scheduledFor).toBe('2026-11-05T07:00:00.000Z');

    // 5. Administrator schedules full series
    const seriesRes = await callHandler(handler, {
      method: 'POST',
      action: 'schedule-newsletter-series',
      cookie: adminCookie,
      body: {
        cadence: 'daily_then_every_second_day',
        dailyDaysCount: 5,
        startAt: '2026-11-03T06:00:00.000Z',
        targetAudience: 'all',
        approveAll: true,
      },
    });
    expect(seriesRes.status).toBe(200);
    const scheduledList = seriesRes.data.newsletters;
    expect(scheduledList[0].cadence).toBe('daily');
    expect(scheduledList[5].cadence).toBe('every_second_day');

    // 6. Administrator sends a bulk or comeback newsletter and tracks opens
    const sendRes = await callHandler(handler, {
      method: 'POST',
      action: 'send-newsletter',
      cookie: adminCookie,
      body: {
        id: 'newsletter-day-1',
        targetAudience: 'inactive_2_3_days',
        isBulk: true,
      },
    });
    expect(sendRes.status).toBe(200);
    expect(sendRes.data.newsletter.status).toBe('sent');
    expect(sendRes.data.results).toHaveLength(1);
    expect(sendRes.data.results[0].email).toBe('sipho@example.com');
    expect(sendRes.data.results[0].subject).toContain('Sipho');
    const dispatchedLogId = sendRes.data.results[0].logId;
    expect(dispatchedLogId).toBeTruthy();

    // 7. Simulate recipient opening the email via tracking pixel
    const openReq: any = {
      method: 'GET',
      url: `/api/platform?action=newsletter-open&logId=${encodeURIComponent(dispatchedLogId)}&email=sipho%40example.com`,
      headers: { host: 'localhost:3007' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    let openStatus = 200;
    const openHeaders: Record<string, string> = {};
    const openResObj: any = {
      setHeader(k: string, v: string) {
        openHeaders[k.toLowerCase()] = v;
      },
      get statusCode() {
        return openStatus;
      },
      set statusCode(val: number) {
        openStatus = val;
      },
      end() {},
    };
    await handler(openReq, openResObj);
    expect(openStatus).toBe(200);
    expect(openHeaders['content-type']).toBe('image/gif');

    // 8. Verify Admin Dashboard sees who opened the email
    const afterOpenRes = await callHandler(handler, {
      method: 'GET',
      action: 'newsletters',
      cookie: adminCookie,
    });
    expect(afterOpenRes.status).toBe(200);
    const trackedLog = afterOpenRes.data.logs.find(
      (l: any) => l.id === dispatchedLogId
    );
    expect(trackedLog).toBeTruthy();
    expect(trackedLog.opened).toBe(true);
    expect(trackedLog.openCount).toBe(1);
    expect(trackedLog.openedAt).toBeTruthy();
  });

  it('prevents live Resend sends during Vitest, hardens corporate deliverability headers/HTML, and syncs Resend bounce & suppression states', async () => {
    // 1. Default process.env under Vitest must never transmit live emails
    const nodeProcess = (
      globalThis as unknown as {
        process: { env: Record<string, string | undefined> };
      }
    ).process;
    const origKey = nodeProcess.env.RESEND_API_KEY;
    const origEnabled = nodeProcess.env.RESEND_ENABLED;
    nodeProcess.env.RESEND_API_KEY = 're_live_should_not_send_in_test';
    nodeProcess.env.RESEND_ENABLED = 'true';
    try {
      expect(resolveResendConfig()).toBeNull();
    } finally {
      if (origKey === undefined) delete nodeProcess.env.RESEND_API_KEY;
      else nodeProcess.env.RESEND_API_KEY = origKey;
      if (origEnabled === undefined) delete nodeProcess.env.RESEND_ENABLED;
      else nodeProcess.env.RESEND_ENABLED = origEnabled;
    }

    // 2. Notification HTML & newsletter hygiene
    const builtFeedback = buildFeedbackNotificationEmail({
      name: 'Sipho Ndlovu',
      email: 'sipho@example.com',
      ratingUserFriendliness: 5,
      ratingCharts: 4,
      ratingSmoothness: 5,
      overallRating: 4.67,
      improvementsText: 'Great replay controls.',
      source: 'email_link',
    });
    expect(builtFeedback.html).toContain('<!DOCTYPE html>');
    expect(builtFeedback.html).toContain('<html lang="en">');
    expect(builtFeedback.html).toContain('mailto:sipho@example.com');

    const newsletterHtml = buildPersonalizedNewsletterEmail({
      newsletter: DEFAULT_NEWSLETTER_TEMPLATES[0],
      recipient: { name: 'Brandon', email: 'info@voomay.co.za' },
      trackingId: 'nl-test-hygiene',
    });
    expect(newsletterHtml.html).not.toContain('opacity:0');
    expect(newsletterHtml.html).not.toContain('mailto:info@voomay.co.za');

    // 3. Headers: never loop reply_to to recipient or embed cross-domain mailto unsubscribe
    const capturedPosts: Array<{ url: string; method: string; body: any }> = [];
    const customEnv = {
      RESEND_API_KEY: 're_mock_test_key',
      RESEND_FROM_EMAIL: 'Chart Replay <noreply@chartreplay.co.za>',
      RESEND_REPLY_TO: 'info@voomay.co.za',
      PUBLIC_APP_URL: 'https://chartreplay.co.za',
    };
    const mockSendFetch = async (url: string, init: any = {}) => {
      const parsedBody = init.body ? JSON.parse(init.body) : null;
      capturedPosts.push({ url, method: init.method || 'GET', body: parsedBody });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `re_msg_${capturedPosts.length}` }),
      };
    };

    await sendFeedbackNotificationEmail(
      {
        name: 'Sipho Ndlovu',
        email: 'sipho@example.com',
        ratingUserFriendliness: 5,
        ratingCharts: 5,
        ratingSmoothness: 5,
        overallRating: 5,
        improvementsText: 'Solid charts',
        source: 'platform',
      },
      { env: customEnv, request: mockSendFetch }
    );
    await sendContactInquiryEmail(
      {
        name: 'Thabo',
        email: 'thabo@example.com',
        category: 'general_inquiry',
        subject: 'Question',
        message: 'Hello team',
      },
      { env: customEnv, request: mockSendFetch }
    );
    await sendResendEmail(
      {
        to: 'info@voomay.co.za',
        subject: 'Newsletter test',
        html: '<p>Hello</p>',
        text: 'Hello',
        unsubscribeUrl: 'https://chartreplay.co.za/?unsubscribe=1&email=info%40voomay.co.za',
      },
      { env: customEnv, request: mockSendFetch }
    );

    expect(capturedPosts).toHaveLength(3);
    for (const post of capturedPosts) {
      expect(post.body.reply_to).toBeUndefined();
    }
    expect(capturedPosts[2].body.headers['List-Unsubscribe']).toBe(
      '<https://chartreplay.co.za/?unsubscribe=1&email=info%40voomay.co.za>'
    );

    // 4. Platform handler: suppression list visibility, bounce/suppressed sync, webhook & unblock
    const adminConfig = {
      email: 'admin@chartreplay.co.za',
      passwordHash: await hashPassword('admin-secret-pass'),
      sessionSecret: 'test-session-secret-key-123456',
    };
    const store = createInMemoryTestStore(adminConfig);
    await store.recordNewsletterLog({
      id: 'nl-suppressed-1',
      newsletterId: 'newsletter-day-1',
      dayNumber: 1,
      badgeText: 'Prop Firm Playbook',
      category: 'prop_firm',
      isBulk: true,
      subject: 'Hi Brandon — Test',
      userEmail: 'info@voomay.co.za',
      userName: 'Brandon',
      sentBy: 'admin@chartreplay.co.za',
      deliveryStatus: 'sent',
      sentAt: '2026-11-10T08:00:00.000Z',
      resendEmailId: 're_email_suppressed_1',
      opened: false,
      openCount: 0,
      clicked: false,
      clickCount: 0,
    });
    await store.recordNewsletterLog({
      id: 'nl-bounced-2',
      newsletterId: 'newsletter-day-1',
      dayNumber: 1,
      badgeText: 'Prop Firm Playbook',
      category: 'prop_firm',
      isBulk: true,
      subject: 'Hi Test — Test',
      userEmail: 'missing@voomay.co.za',
      userName: 'Missing',
      sentBy: 'admin@chartreplay.co.za',
      deliveryStatus: 'sent',
      sentAt: '2026-11-10T08:01:00.000Z',
      resendEmailId: 're_email_bounced_2',
      opened: false,
      openCount: 0,
      clicked: false,
      clickCount: 0,
    });

    let activeSuppressions = [
      {
        id: 'sup-1',
        email: 'info@voomay.co.za',
        origin: 'bounce',
        source_id: '01a19dfe-832d-790d-b650-e41452e12b41',
        created_at: '2026-11-02T20:41:12.000Z',
      },
    ];
    const mockResendApi = async (url: string, init: any = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      if (url.startsWith('https://api.resend.com/suppressions/info%40voomay.co.za') && method === 'DELETE') {
        activeSuppressions = [];
        return { ok: true, status: 200, json: async () => ({ deleted: true }) };
      }
      if (url.startsWith('https://api.resend.com/suppressions') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ object: 'list', has_more: false, data: activeSuppressions }),
        };
      }
      if (url.endsWith('/re_email_suppressed_1') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 're_email_suppressed_1', last_event: 'suppressed' }),
        };
      }
      if (url.endsWith('/re_email_bounced_2') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 're_email_bounced_2',
            last_event: 'bounced',
            bounce: { diagnosticCode: ['smtp; 550 No such recipient here'] },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
    };

    const handler = createPlatformHandler({
      store,
      env: customEnv,
      request: mockResendApi,
    });
    const adminCookie = `chart_replay_admin=${createAdminSession(adminConfig, Date.now())}`;

    const nlRes = await callHandler(handler, {
      method: 'GET',
      action: 'newsletters',
      cookie: adminCookie,
    });
    expect(nlRes.status).toBe(200);
    expect(nlRes.data.suppressedRecipients).toHaveLength(1);
    expect(nlRes.data.suppressedRecipients[0].email).toBe('info@voomay.co.za');

    const supLog = nlRes.data.logs.find((l: any) => l.id === 'nl-suppressed-1');
    const bncLog = nlRes.data.logs.find((l: any) => l.id === 'nl-bounced-2');
    expect(supLog.deliveryStatus).toBe('suppressed');
    expect(supLog.deliveryError).toContain('suppression list');
    expect(bncLog.deliveryStatus).toBe('bounced');
    expect(bncLog.deliveryError).toContain('550 No such recipient here');

    // Webhook updates delivery status cleanly too
    const webhookRes = await callHandler(handler, {
      method: 'POST',
      action: 'resend-webhook',
      body: {
        type: 'email.delivered',
        data: { email_id: 're_email_suppressed_1', to: ['info@voomay.co.za'] },
      },
    });
    expect(webhookRes.status).toBe(200);
    const updatedAfterWebhook = (await store.readNewsletterLogs()).find(
      (l: any) => l.id === 'nl-suppressed-1'
    );
    expect(updatedAfterWebhook.deliveryStatus).toBe('delivered');

    // Admin unblocks suppressed recipient
    const unblockRes = await callHandler(handler, {
      method: 'POST',
      action: 'remove-email-suppression',
      cookie: adminCookie,
      body: { email: 'info@voomay.co.za' },
    });
    expect(unblockRes.status).toBe(200);
    expect(unblockRes.data.email).toBe('info@voomay.co.za');
    expect(unblockRes.data.suppressedRecipients).toEqual([]);
  });
});
