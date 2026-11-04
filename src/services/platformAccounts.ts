import {getRegisteredUsers,setActiveLoggedInUser,purgeBrowserSensitiveStorage,RegisteredUser} from './storageAndAnalytics';
import {
  submitPlatformFeedbackToSupabase,
  fetchPlatformFeedbackFromSupabase,
  fetchFeedbackEmailLogsFromSupabase,
  submitContactInquiryToSupabase,
  fetchContactInquiriesFromSupabase,
  PlatformFeedbackItem,
  FeedbackEmailLogItem,
  ContactInquiryCategory,
  ContactInquiryItem,
} from './supabaseClient';

export const OFFICIAL_CONTACT_EMAIL = 'info@voomay.co.za';
export const PERSONAL_CONTACT_EMAIL = 'cheslin@voomay.co.za';
export type { ContactInquiryCategory, ContactInquiryItem };
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  loginCount: number | null;
  lastLoginAt: string | null;
  lastSeenAt?: string | null;
  sessionCount?: number | null;
  tradeCount?: number | null;
  hasTradingPlan?: boolean;
  tradingPlanName?: string | null;
  tradingPlanCount?: number | null;
  isOnlineNow?: boolean;
  currentSessionSeconds?: number | null;
  totalTimeOnPlatformSeconds?: number | null;
  platformMemberDurationSeconds?: number | null;
  source: 'server' | 'browser';
}
export function localAdminProfiles(): AdminUser[] {
  const nowMs = Date.now();
  return getRegisteredUsers()
    .filter((user) => user.id !== 'user-demo-trader' && user.authSource !== 'server')
    .map((user) => {
      const joinedMs = user.joinedAt ? Date.parse(user.joinedAt) : NaN;
      const loginMs = user.lastLoginAt ? Date.parse(user.lastLoginAt) : NaN;
      const memberSec = Number.isFinite(joinedMs)
        ? Math.max(60, Math.round(Math.max(0, nowMs - joinedMs) / 1000))
        : 60;
      const sessionSec = Number.isFinite(loginMs)
        ? Math.max(120, Math.min(3600, Math.round(Math.max(60000, nowMs - loginMs) / 1000)))
        : 120;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: user.joinedAt,
        loginCount: user.loginCount ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        currentSessionSeconds: sessionSec,
        totalTimeOnPlatformSeconds: Math.max(sessionSec, (user.loginCount || 1) * 300),
        platformMemberDurationSeconds: memberSec,
        source: 'browser' as const,
      };
    });
}
export async function platformRequest(action:string,body?:object){
 const response=await fetch(`/api/platform?action=${encodeURIComponent(action)}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',signal:AbortSignal.timeout(15000)}:{credentials:'same-origin',signal:AbortSignal.timeout(15000)});
 const data=await response.json();return {ok:response.ok,status:response.status,...data};
}
export async function serverAccountRequest(action:'register'|'login',body:{name?:string;email:string;password:string}){
 const result=await platformRequest(action,body);
 if(result.status===503&&String(result.error||'').toLowerCase().includes('not configured')){
  return {available:false,ok:false,status:result.status,user:undefined as RegisteredUser|undefined,error:undefined as string|undefined,welcomeEmailSent:false,lockedOut:false,lockedUntil:0,retryAfterSeconds:0,remainingAttempts:undefined as number|undefined};
 }
 if(result.status>=500)throw Error('Account service unavailable. Please try again.');
 if(!result.ok||!result.user){
  return {
   available:true,
   ok:false,
   status:result.status,
   user:undefined as RegisteredUser|undefined,
   error:result.error as string,
   welcomeEmailSent:false,
   lockedOut:Boolean(result.lockedOut||result.status===429),
   lockedUntil:typeof result.lockedUntil==='number'?result.lockedUntil:result.status===429?Date.now()+(Number(result.retryAfterSeconds)||30)*1000:0,
   retryAfterSeconds:typeof result.retryAfterSeconds==='number'?result.retryAfterSeconds:result.status===429?30:0,
   remainingAttempts:typeof result.remainingAttempts==='number'?result.remainingAttempts:undefined,
  };
 }
 const user:RegisteredUser={...result.user,authSource:'server',passwordHash:''};
 purgeBrowserSensitiveStorage();
 setActiveLoggedInUser(user);return {available:true,ok:true,status:result.status,user,error:undefined,welcomeEmailSent:Boolean(result.welcomeEmailSent),lockedOut:false,lockedUntil:0,retryAfterSeconds:0,remainingAttempts:3};
}
export async function requestPasswordResetEmail(email:string){
 const result=await platformRequest('request-password-reset',{email});
 if(result.status===503){
  return {available:false,ok:false,message:undefined as string|undefined,error:result.error as string|undefined};
 }
 if(!result.ok)return {available:true,ok:false,message:undefined as string|undefined,error:(result.error as string)||'Could not send password reset email.'};
 return {available:true,ok:true,message:(result.message as string)||'If an account exists for that email address, we have sent a password reset link.',error:undefined};
}
export async function completePasswordResetWithToken(token:string,newPassword:string){
 const result=await platformRequest('reset-password',{token,password:newPassword});
 if(!result.ok||!result.user)return {ok:false,user:undefined as RegisteredUser|undefined,error:(result.error as string)||'Unable to reset password.'};
 const user:RegisteredUser={...result.user,authSource:'server',passwordHash:''};
 purgeBrowserSensitiveStorage();
 setActiveLoggedInUser(user);
 return {ok:true,user,error:undefined};
}

let memoryAdminImpersonation: AdminImpersonationInfo | null = null;

export interface AdminImpersonationInfo {
  userId: string;
  userName: string;
  userEmail: string;
  adminEmail: string;
  startedAt: string;
}

export function getAdminImpersonationState(): AdminImpersonationInfo | null {
  return memoryAdminImpersonation;
}

export function clearAdminImpersonationState(): void {
  memoryAdminImpersonation = null;
}

export async function adminImpersonateUser(
  target: { id?: string; email: string; name?: string },
  preview = false
): Promise<{
  ok: boolean;
  user?: RegisteredUser;
  impersonation?: AdminImpersonationInfo;
  error?: string;
}> {
  if (preview) {
    const user: RegisteredUser = {
      id: target.id || `preview-${Date.now()}`,
      name: target.name || 'Preview Trader',
      email: target.email.toLowerCase(),
      passwordHash: '',
      authSource: 'server',
      plan: 'FREE_FOREVER',
      joinedAt: new Date().toISOString(),
      loginCount: 2,
    };
    const impersonation: AdminImpersonationInfo = {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      adminEmail: 'Dashboard preview',
      startedAt: new Date().toISOString(),
    };
    memoryAdminImpersonation = impersonation;
    setActiveLoggedInUser(user);
    return { ok: true, user, impersonation };
  }

  const result = await platformRequest('admin-impersonate', {
    userId: target.id,
    email: target.email,
    name: target.name,
  });
  if (!result.ok || !result.user) {
    return {
      ok: false,
      error: (result.error as string) || 'Only the signed-in administrator can log into a user account.',
    };
  }
  const user: RegisteredUser = {
    ...result.user,
    authSource: 'server',
    passwordHash: '',
    plan: 'FREE_FOREVER',
  };
  const impersonation: AdminImpersonationInfo = {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    adminEmail: (result.impersonatedBy as string) || 'admin',
    startedAt: new Date().toISOString(),
  };
  memoryAdminImpersonation = impersonation;
  purgeBrowserSensitiveStorage();
  setActiveLoggedInUser(user);
  return { ok: true, user, impersonation };
}

export async function loadAdminFeedbackData(preview = false): Promise<{
  ok: boolean;
  feedback: PlatformFeedbackItem[];
  emailLogs: FeedbackEmailLogItem[];
  contactInquiries: ContactInquiryItem[];
  resendConfigured: boolean;
}> {
  if (preview) {
    return {
      ok: true,
      resendConfigured: true,
      feedback: [
        {
          id: 'preview-fb-1',
          userEmail: 'trader1@example.invalid',
          userName: 'Lerato Mokoena',
          ratingUserFriendliness: 5,
          ratingCharts: 5,
          ratingSmoothness: 4,
          overallRating: 4.67,
          improvementsText: 'Really love the on-chart sticky trading plan and bar replay speed. Adding keyboard shortcuts for stepping 1 bar forward would make it even faster!',
          source: 'once_popup',
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
        {
          id: 'preview-fb-2',
          userEmail: 'trader2@example.invalid',
          userName: 'James Smith',
          ratingUserFriendliness: 4,
          ratingCharts: 5,
          ratingSmoothness: 5,
          overallRating: 4.67,
          improvementsText: 'Super smooth charts on XAUUSD and NAS100. Everything is very intuitive.',
          source: 'email_link',
          createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
        },
      ],
      emailLogs: [
        {
          id: 'preview-log-1',
          userEmail: 'trader1@example.invalid',
          userName: 'Lerato Mokoena',
          sentBy: 'admin',
          deliveryStatus: 'sent',
          sentAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      ],
      contactInquiries: [
        {
          id: 'preview-inq-1',
          userEmail: 'academy@example.invalid',
          userName: 'Apex Trading Academy',
          category: 'partnership',
          subject: 'Prop Firm & Academy Partnership Inquiry',
          message: 'We train 450+ forex and gold traders in South Africa and would love to partner with Chart Replay for our student backtesting curriculum.',
          recipientEmail: OFFICIAL_CONTACT_EMAIL,
          emailSent: true,
          source: 'contact_page',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'preview-inq-2',
          userEmail: 'trader1@example.invalid',
          userName: 'Lerato Mokoena',
          category: 'improvement',
          subject: 'Custom session highlight colors',
          message: 'Would be awesome if we could customize the Asian/London/NY session box opacity directly from the top bar.',
          recipientEmail: OFFICIAL_CONTACT_EMAIL,
          emailSent: true,
          source: 'contact_page',
          createdAt: new Date(Date.now() - 3600000 * 9).toISOString(),
        },
      ],
    };
  }

  const [serverRes, directFeedback, directLogs, directInquiries] = await Promise.allSettled([
    platformRequest('feedback'),
    fetchPlatformFeedbackFromSupabase(),
    fetchFeedbackEmailLogsFromSupabase(),
    fetchContactInquiriesFromSupabase(),
  ]);

  const srv = serverRes.status === 'fulfilled' && serverRes.value?.ok ? serverRes.value : null;
  const feedbackMap = new Map<string, PlatformFeedbackItem>();
  if (Array.isArray(srv?.feedback)) {
    for (const item of srv.feedback as PlatformFeedbackItem[]) {
      if (item && item.id) feedbackMap.set(item.id, item);
    }
  }
  if (directFeedback.status === 'fulfilled' && Array.isArray(directFeedback.value)) {
    for (const item of directFeedback.value) {
      if (item && item.id && !feedbackMap.has(item.id)) feedbackMap.set(item.id, item);
    }
  }

  const logMap = new Map<string, FeedbackEmailLogItem>();
  if (Array.isArray(srv?.emailLogs)) {
    for (const item of srv.emailLogs as FeedbackEmailLogItem[]) {
      if (item && item.id) logMap.set(item.id, item);
    }
  }
  if (directLogs.status === 'fulfilled' && Array.isArray(directLogs.value)) {
    for (const item of directLogs.value) {
      if (item && item.id && !logMap.has(item.id)) logMap.set(item.id, item);
    }
  }

  const inquiryMap = new Map<string, ContactInquiryItem>();
  if (Array.isArray(srv?.contactInquiries)) {
    for (const item of srv.contactInquiries as ContactInquiryItem[]) {
      if (item && item.id) inquiryMap.set(item.id, item);
    }
  }
  if (directInquiries.status === 'fulfilled' && Array.isArray(directInquiries.value)) {
    for (const item of directInquiries.value) {
      if (item && item.id && !inquiryMap.has(item.id)) inquiryMap.set(item.id, item);
    }
  }

  return {
    ok: true,
    feedback: Array.from(feedbackMap.values()).sort(
      (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
    ),
    emailLogs: Array.from(logMap.values()).sort(
      (a, b) => (Date.parse(b.sentAt || '') || 0) - (Date.parse(a.sentAt || '') || 0)
    ),
    contactInquiries: Array.from(inquiryMap.values()).sort(
      (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
    ),
    resendConfigured: Boolean(srv?.resendConfigured),
  };
}

export async function sendAdminFeedbackEmails(
  recipients: Array<{ email: string; name: string }>,
  preview = false
): Promise<{
  ok: boolean;
  results?: Array<{
    email: string;
    name: string;
    sent: boolean;
    error?: string | null;
    feedbackUrl: string;
  }>;
  resendConfigured?: boolean;
  error?: string;
}> {
  if (preview) {
    return {
      ok: true,
      resendConfigured: true,
      results: recipients.map((r) => ({
        email: r.email,
        name: r.name,
        sent: true,
        feedbackUrl: `${window.location.origin}/?feedback=1&email=${encodeURIComponent(
          r.email
        )}&name=${encodeURIComponent(r.name)}`,
      })),
    };
  }
  const res = await platformRequest('send-feedback-email', { recipients });
  if (!res.ok) {
    return {
      ok: false,
      error: (res.error as string) || 'Unable to send feedback email.',
    };
  }
  return {
    ok: true,
    results: res.results,
    resendConfigured: Boolean(res.resendConfigured),
  };
}

export async function submitTraderPlatformFeedback(input: {
  name: string;
  email: string;
  userId?: string | null;
  ratingUserFriendliness: number;
  ratingCharts: number;
  ratingSmoothness: number;
  improvementsText: string;
  favoriteText?: string;
  source?: string;
}): Promise<{ ok: boolean; feedback?: PlatformFeedbackItem; error?: string }> {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  const createdAt = new Date().toISOString();
  const payload = {
    id,
    userId: input.userId || null,
    userEmail: input.email.trim().toLowerCase() || 'anonymous@chartreplay.co.za',
    userName: input.name.trim() || 'Trader',
    ratingUserFriendliness: input.ratingUserFriendliness,
    ratingCharts: input.ratingCharts,
    ratingSmoothness: input.ratingSmoothness,
    improvementsText: input.improvementsText.trim(),
    favoriteText: (input.favoriteText || '').trim(),
    source: input.source || 'email_link',
    createdAt,
  };

  const [serverRes, supabaseDirectOk] = await Promise.allSettled([
    platformRequest('submit-feedback', {
      id: payload.id,
      name: payload.userName,
      email: payload.userEmail,
      ratingUserFriendliness: payload.ratingUserFriendliness,
      ratingCharts: payload.ratingCharts,
      ratingSmoothness: payload.ratingSmoothness,
      improvementsText: payload.improvementsText,
      favoriteText: payload.favoriteText,
      source: payload.source,
    }),
    submitPlatformFeedbackToSupabase(payload),
  ]);

  const srvOk = serverRes.status === 'fulfilled' && Boolean(serverRes.value?.ok);
  const directOk = supabaseDirectOk.status === 'fulfilled' && Boolean(supabaseDirectOk.value);

  if (!srvOk && !directOk) {
    const errMsg =
      serverRes.status === 'fulfilled' && serverRes.value?.error
        ? String(serverRes.value.error)
        : 'Unable to save your feedback right now. Please try again.';
    return { ok: false, error: errMsg };
  }

  const overallRating = Number(
    (
      (payload.ratingUserFriendliness +
        payload.ratingCharts +
        payload.ratingSmoothness) /
      3
    ).toFixed(2)
  );
  return {
    ok: true,
    feedback: {
      ...payload,
      overallRating,
    },
  };
}

export async function submitContactInquiry(input: {
  name: string;
  email: string;
  userId?: string | null;
  category: ContactInquiryCategory;
  subject?: string;
  message: string;
  source?: string;
}): Promise<{
  ok: boolean;
  inquiry?: ContactInquiryItem;
  emailSent?: boolean;
  recipientEmail: string;
  error?: string;
}> {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  const createdAt = new Date().toISOString();
  const payload: ContactInquiryItem = {
    id,
    userId: input.userId || null,
    userEmail: input.email.trim().toLowerCase(),
    userName: input.name.trim() || 'Trader',
    category: input.category || 'general_inquiry',
    subject: (input.subject || '').trim(),
    message: input.message.trim(),
    recipientEmail: OFFICIAL_CONTACT_EMAIL,
    emailSent: false,
    source: input.source || 'contact_page',
    createdAt,
  };

  if (!payload.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.userEmail)) {
    return {
      ok: false,
      recipientEmail: OFFICIAL_CONTACT_EMAIL,
      error: 'Please enter a valid email address so we can reply to you.',
    };
  }
  if (!payload.message) {
    return {
      ok: false,
      recipientEmail: OFFICIAL_CONTACT_EMAIL,
      error: 'Please enter a message before sending.',
    };
  }

  const [serverRes, supabaseDirectOk] = await Promise.allSettled([
    platformRequest('submit-contact', {
      id: payload.id,
      userId: payload.userId,
      name: payload.userName,
      email: payload.userEmail,
      category: payload.category,
      subject: payload.subject,
      message: payload.message,
      source: payload.source,
    }),
    submitContactInquiryToSupabase(payload),
  ]);

  const srvOk = serverRes.status === 'fulfilled' && Boolean(serverRes.value?.ok);
  const directOk = supabaseDirectOk.status === 'fulfilled' && Boolean(supabaseDirectOk.value);
  const emailSent =
    serverRes.status === 'fulfilled' && Boolean(serverRes.value?.emailSent);

  if (!srvOk && !directOk) {
    const errMsg =
      serverRes.status === 'fulfilled' && serverRes.value?.error
        ? String(serverRes.value.error)
        : 'Unable to send your message right now. Please try again or email info@voomay.co.za directly.';
    return { ok: false, recipientEmail: OFFICIAL_CONTACT_EMAIL, error: errMsg };
  }

  return {
    ok: true,
    inquiry: {
      ...payload,
      emailSent,
    },
    emailSent,
    recipientEmail: OFFICIAL_CONTACT_EMAIL,
  };
}

export type NewsletterCadence =
  | 'daily'
  | 'every_second_day'
  | 'daily_then_every_second_day';

export type NewsletterTargetAudience =
  | 'all'
  | 'inactive_2_3_days'
  | 'active'
  | 'new_starters'
  | 'selected';

export type NewsletterStatus =
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'sent';

export interface NewsletterEditionItem {
  id: string;
  dayNumber: number;
  cadence: NewsletterCadence;
  category?: string;
  phaseLabel: string;
  badgeText: string;
  subject: string;
  headline: string;
  bodyText: string;
  steps?: NewsletterStepItem[];
  actionTip: string;
  ctaText: string;
  status: NewsletterStatus;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  scheduledFor: string | null;
  targetAudience: NewsletterTargetAudience;
  selectedRecipients: string[];
  sentAt: string | null;
  sentCount: number;
  updatedAt?: string;
}

export interface NewsletterDeliveryLogItem {
  id: string;
  newsletterId: string;
  dayNumber: number;
  badgeText?: string;
  category?: string;
  subject: string;
  userEmail: string;
  userName: string;
  sentBy: string;
  deliveryStatus: string;
  sentAt: string;
  isBulk?: boolean;
  resendEmailId?: string | null;
  opened?: boolean;
  openedAt?: string | null;
  firstOpenedAt?: string | null;
  openCount?: number;
  clicked?: boolean;
  clickedAt?: string | null;
  clickCount?: number;
}

export const DEFAULT_CLIENT_NEWSLETTER_TEMPLATES: NewsletterEditionItem[] = [
  {
    id: 'newsletter-day-1',
    dayNumber: 1,
    cadence: 'daily',
    category: 'Prop Firm Playbook',
    phaseLabel: 'Prop Firm Playbook · 5 Steps',
    badgeText: 'Prop Firm Playbook · 5 Steps',
    subject: 'Hi {{firstName}} — 5 Steps How to Pass a Prop Firm Challenge Without Stress',
    headline: '5 Steps to Pass Your Next Prop Firm Evaluation With Calm Precision, {{firstName}}.',
    bodyText:
      'Traders fail prop firm challenges because they try to pass in two days. Funded professionals pass because they treat the evaluation like a structured checklist.\n\n1. Lock In Your Daily Risk Cap (0.5% to 1% Max): Decide your exact risk per trade before the session opens so a single stop-out never threatens your daily drawdown limit.\n2. Trade Only One Liquidity Window: Focus exclusively on London Open or New York Open on XAU/USD, NAS100, or EUR/USD instead of chasing choppy mid-day candles.\n3. Require 3 Checklist Confluences Before Clicking: Pin {{tradingPlanName}} onto your chart and demand structure, liquidity sweep, and clean session timing before entering.\n4. Protect Your Mental Capital After Any Trade: Whether the trade hits +2R or -1R, pause for 60 seconds and log why you took the setup before looking for another candle.\n5. Stop at 2 Wins or 2 Losses Per Session: Consistency beats home runs — bank your progress inside the Prop Firm Simulator and return fresh tomorrow.',
    steps: [
      'Lock In Your Daily Risk Cap (0.5% to 1% Max): Decide your exact risk per trade before the session opens so a single stop-out never threatens your daily drawdown limit.',
      'Trade Only One Liquidity Window: Focus exclusively on London Open or New York Open on XAU/USD, NAS100, or EUR/USD instead of chasing choppy mid-day candles.',
      'Require 3 Checklist Confluences Before Clicking: Pin {{tradingPlanName}} onto your chart and demand structure, liquidity sweep, and clean session timing before entering.',
      'Protect Your Mental Capital After Any Trade: Whether the trade hits +2R or -1R, pause for 60 seconds and log why you took the setup before looking for another candle.',
      'Stop at 2 Wins or 2 Losses Per Session: Consistency beats home runs — bank your progress inside the Prop Firm Simulator and return fresh tomorrow.',
    ],
    actionTip:
      'Open a Prop Firm Challenge session on Chart Replay today and execute 3 textbook trades following these 5 steps with zero drawdown violations.',
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
    category: 'Trading Psychology',
    phaseLabel: 'Trading Psychology · 5 Steps',
    badgeText: 'Trading Psychology · 5 Steps',
    subject: 'Hi {{firstName}} — 5 Steps to Eliminate Revenge Trading Before the Next Candle Closes',
    headline: 'Your response to a red trade defines your trading career, {{firstName}}.',
    bodyText:
      'A loss that followed {{tradingPlanName}} is still a good trade — it is simply the cost of doing business in probability. The account killer is never the first loss; it is the emotional revenge trade taken two minutes later.\n\n1. Accept the -1R Before You Enter: Size your position with the Order Ticket calculator so if price hits your stop-loss, you feel zero emotional shock.\n2. Hands Off the Mouse for 60 Seconds: The moment a stop-loss triggers, pause the chart replay and take a breath before advancing the next bar.\n3. Grade Rule Execution, Not Outcome: Ask yourself one question — did this trade follow {{tradingPlanName}}? If yes, log it as a disciplined execution.\n4. Never Double Lot Size to "Make It Back": Keep your next trade at the exact same risk percentage or cut risk in half until your rhythm returns.\n5. Demand a Fresh Structural Setup: Wait for price to form a brand-new session high/low sweep before taking another entry.',
    steps: [
      'Accept the -1R Before You Enter: Size your position with the Order Ticket calculator so if price hits your stop-loss, you feel zero emotional shock.',
      'Hands Off the Mouse for 60 Seconds: The moment a stop-loss triggers, pause the chart replay and take a breath before advancing the next bar.',
      'Grade Rule Execution, Not Outcome: Ask yourself one question — did this trade follow {{tradingPlanName}}? If yes, log it as a disciplined execution.',
      'Never Double Lot Size to "Make It Back": Keep your next trade at the exact same risk percentage or cut risk in half until your rhythm returns.',
      'Demand a Fresh Structural Setup: Wait for price to form a brand-new session high/low sweep before taking another entry.',
    ],
    actionTip:
      'Make a personal rule today: after any losing trade in replay, pause for 30 seconds, verify higher-timeframe structure, and never increase risk on the next trade.',
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
    category: 'Comeback Motivation (2–3+ Days Inactive)',
    phaseLabel: 'We Missed You · 3 Steps to Return',
    badgeText: 'Comeback Playbook · 3 Steps',
    subject: 'Hi {{firstName}} — We missed you on Chart Replay! 3 steps to get back in rhythm',
    headline: 'It only takes 15 focused minutes to sharpen your edge again, {{firstName}}.',
    bodyText:
      'Stepping away from the charts for a couple of days happens to every trader — what matters is how cleanly you step back into your routine without forcing trades.\n\n1. Open a 15-Minute Warm-Up Replay: Pick your favorite instrument (Gold XAU/USD, NAS100, or GBP/USD) and step through 20 bars just reading market structure.\n2. Pin Your Trading Plan on the Chart: Review {{tradingPlanName}} before placing a single order so your eyes know the exact A+ setup to look for.\n3. Take Just 1 High-Conviction Setup: Execute one textbook trade with a pre-set stop-loss and take-profit to rebuild momentum effortlessly.',
    steps: [
      'Open a 15-Minute Warm-Up Replay: Pick your favorite instrument (Gold XAU/USD, NAS100, or GBP/USD) and step through 20 bars just reading market structure.',
      'Pin Your Trading Plan on the Chart: Review {{tradingPlanName}} before placing a single order so your eyes know the exact A+ setup to look for.',
      'Take Just 1 High-Conviction Setup: Execute one textbook trade with a pre-set stop-loss and take-profit to rebuild momentum effortlessly.',
    ],
    actionTip:
      'Jump back into Chart Replay for just 15 minutes today and complete one clean warm-up trade following your plan.',
    ctaText: 'Resume My Practice Session →',
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
    category: 'Institutional Patience',
    phaseLabel: 'Execution & Edge · 5 Steps',
    badgeText: 'Execution & Edge · 5 Steps',
    subject: 'Hi {{firstName}} — 5 Steps to Stop Overtrading and Wait for Your A+ Setup',
    headline: 'Sitting on your hands is how institutions build their edge, {{firstName}}.',
    bodyText:
      '80% of market movement is low-probability consolidation. The fastest way to grow your win rate is learning how to skip the chop and strike only when liquidity and structure align.\n\n1. Mark Higher-Timeframe Liquidity First: Before stepping forward on the 5m or 15m chart, mark the previous day high/low and session key levels on the 1H/4H chart.\n2. Fast-Forward Through Asian & Mid-Day Chop: Use the bar-by-bar forward button on Chart Replay to skip sideways ranges where spreads and fakeouts trap impatient traders.\n3. Wait for the Liquidity Sweep + Displacement: Let price raid an obvious high or low and close back inside structure before preparing your order ticket.\n4. Verify Minimum 1:2 Risk-to-Reward: If the next opposing liquidity pool does not offer at least 2R of clean room, pass on the trade.\n5. Log Every Trade You Filtered Out: Celebrating the bad trades you skipped builds institutional patience faster than anything else.',
    steps: [
      'Mark Higher-Timeframe Liquidity First: Before stepping forward on the 5m or 15m chart, mark the previous day high/low and session key levels on the 1H/4H chart.',
      'Fast-Forward Through Asian & Mid-Day Chop: Use the bar-by-bar forward button on Chart Replay to skip sideways ranges where spreads and fakeouts trap impatient traders.',
      'Wait for the Liquidity Sweep + Displacement: Let price raid an obvious high or low and close back inside structure before preparing your order ticket.',
      'Verify Minimum 1:2 Risk-to-Reward: If the next opposing liquidity pool does not offer at least 2R of clean room, pass on the trade.',
      'Log Every Trade You Filtered Out: Celebrating the bad trades you skipped builds institutional patience faster than anything else.',
    ],
    actionTip:
      'Practice skipping at least 20 candles of sideways chop in your replay session today until a clean London or New York setup forms.',
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
    category: 'Risk & R-Multiples',
    phaseLabel: 'Risk Management · 4 Steps',
    badgeText: 'Risk Management · 4 Steps',
    subject: 'Hi {{firstName}} — 4 Steps to Detach From Money and Trade in R-Multiples',
    headline: 'Master execution quality by thinking in Risk Units (R), {{firstName}}.',
    bodyText:
      'When you stare at currency fluctuations while a trade is open, fear makes you close winners at +0.4R and hope makes you hold losers past your stop-loss.\n\n1. Define 1R Before Clicking Buy or Sell: Use the Chart Replay Order Ticket to lock in a fixed risk percentage so every trade carries identical weight.\n2. Place Stop-Loss at Structural Invalidation: Set your stop where your trade idea is objectively wrong — never widen it once price starts moving.\n3. Let Winners Run to Pre-Planned Targets: Allow the bars to play out to your +2R or +3R target without panic-closing on the first pullback candle.\n4. Measure Weekly Progress in Net R: A +5R week following {{tradingPlanName}} is the exact same skill whether 1R equals $25 or $2,500.',
    steps: [
      'Define 1R Before Clicking Buy or Sell: Use the Chart Replay Order Ticket to lock in a fixed risk percentage so every trade carries identical weight.',
      'Place Stop-Loss at Structural Invalidation: Set your stop where your trade idea is objectively wrong — never widen it once price starts moving.',
      'Let Winners Run to Pre-Planned Targets: Allow the bars to play out to your +2R or +3R target without panic-closing on the first pullback candle.',
      'Measure Weekly Progress in Net R: A +5R week following {{tradingPlanName}} is the exact same skill whether 1R equals $25 or $2,500.',
    ],
    actionTip:
      'Set your stop-loss and take-profit before entering today, then let the candles play out to either +R or -1R without touching your stop.',
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
    category: 'Trading Plan Mastery',
    phaseLabel: 'Trading Playbook · 5 Steps',
    badgeText: 'Trading Playbook · 5 Steps',
    subject: '{{firstName}}, 5 Steps to Treat Your Trading Plan Like a High-Performance Business',
    headline: 'Amateur traders improvise while price moves — professionals execute a written checklist, {{firstName}}.',
    bodyText:
      'When you have {{tradingPlanName}} visible right on your chart, hesitation disappears. Either price gives you your exact setup at your key level, or you stay flat.\n\n1. Pin Your Sticky Trading Plan on the Chart: Keep your core entry rules visible on screen during every replay session.\n2. Define Your Exact Session & Pair Focus: Stick to 1 or 2 markets you know intimately instead of jumping across 10 random pairs.\n3. Check Off Every Entry Criterion Out Loud: Confirm trend direction, key level reaction, and stop-loss placement before submitting your order.\n4. Screenshot or Journal Your Entry Reason: Write one clear sentence explaining why the setup qualified under your rules.\n5. Review Your Session Equity & Rule Score: End your session by checking whether you followed 100% of your plan regardless of win or loss.',
    steps: [
      'Pin Your Sticky Trading Plan on the Chart: Keep your core entry rules visible on screen during every replay session.',
      'Define Your Exact Session & Pair Focus: Stick to 1 or 2 markets you know intimately instead of jumping across 10 random pairs.',
      'Check Off Every Entry Criterion Out Loud: Confirm trend direction, key level reaction, and stop-loss placement before submitting your order.',
      'Screenshot or Journal Your Entry Reason: Write one clear sentence explaining why the setup qualified under your rules.',
      'Review Your Session Equity & Rule Score: End your session by checking whether you followed 100% of your plan regardless of win or loss.',
    ],
    actionTip:
      'Before clicking Buy or Sell today, read your sticky trading plan checklist. If the candle does not match your rules, step forward one bar and wait.',
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
    category: 'Accelerated Backtesting',
    phaseLabel: 'Deliberate Practice · 5 Steps',
    badgeText: 'Deliberate Practice · 5 Steps',
    subject: '{{firstName}}, 5 Steps to Compress 6 Months of Market Experience Into One Week',
    headline: 'Deliberate practice on Chart Replay is your unfair advantage, {{firstName}}.',
    bodyText:
      'Waiting for live candles takes months to see 50 examples of your setup. On Chart Replay, you can step through 50 high-quality setups in a single week and build unshakable pattern recognition.\n\n1. Choose One Setup to Master This Week: Focus on a single repeatable pattern (such as a London sweep & break of structure on XAU/USD).\n2. Run a Focused 20-Minute Replay Block: Eliminate distractions and step candle-by-candle through historical price action.\n3. Execute With Real Position Sizing: Always calculate exact lot sizes so your muscle memory matches live market execution.\n4. Track Win Rate and Average R-Multiple: Let the platform analytics show you objectively where your edge is strongest.\n5. Refine One Rule at a Time: Use your replay data to tighten your stop placement or take-profit targets with statistical confidence.',
    steps: [
      'Choose One Setup to Master This Week: Focus on a single repeatable pattern (such as a London sweep & break of structure on XAU/USD).',
      'Run a Focused 20-Minute Replay Block: Eliminate distractions and step candle-by-candle through historical price action.',
      'Execute With Real Position Sizing: Always calculate exact lot sizes so your muscle memory matches live market execution.',
      'Track Win Rate and Average R-Multiple: Let the platform analytics show you objectively where your edge is strongest.',
      'Refine One Rule at a Time: Use your replay data to tighten your stop placement or take-profit targets with statistical confidence.',
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
    category: 'Bulk Broadcast / Custom Playbook',
    phaseLabel: 'Community Broadcast · 3 Steps',
    badgeText: 'Trader Momentum · 3 Steps',
    subject: 'Hi {{firstName}} — 3 Quick Steps to Sharpen Your Chart Execution Today',
    headline: 'Small daily improvements compound into funded consistency, {{firstName}}.',
    bodyText:
      'Every time you step onto the chart with a clear checklist, you separate yourself from the 90% of traders who trade on impulse.\n\n1. Map Your Key Session Levels Before Pressing Play: Identify where stops are resting above highs and below lows before advancing the candles.\n2. Wait for Your Exact Trigger Candle: Let the market come to your price level and confirm direction before risking capital.\n3. Protect Your Risk and Log the Outcome: Keep risk strictly capped at 1% and review your execution inside Chart Replay.',
    steps: [
      'Map Your Key Session Levels Before Pressing Play: Identify where stops are resting above highs and below lows before advancing the candles.',
      'Wait for Your Exact Trigger Candle: Let the market come to your price level and confirm direction before risking capital.',
      'Protect Your Risk and Log the Outcome: Keep risk strictly capped at 1% and review your execution inside Chart Replay.',
    ],
    actionTip:
      'Take 15 minutes on Chart Replay today to practice these 3 steps on Gold (XAU/USD), NAS100, or your favorite forex pair.',
    ctaText: 'Start Replay Session Now →',
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

export function stripClientLegacyDayPrefix(text: string): string {
  const cleaned = String(text ?? '')
    .replace(/^Day\s+\d+\s*[·•\-:|]\s*/i, '')
    .replace(/\(Day\s+\d+\)/gi, '')
    .replace(/Daily\s+Trader\s+Motivation/gi, 'Trader Playbook')
    .replace(/Every\s+2nd\s+Day\s+Coaching/gi, 'Trader Playbook')
    .trim();
  return cleaned || 'Trader Playbook';
}

export type NewsletterStepItem = string | { title?: string; description?: string };

export function extractClientNewsletterStepsAndIntro(
  bodyText: string,
  explicitSteps?: NewsletterStepItem[]
): { introParagraphs: string[]; steps: string[] } {
  const normalizedBody = String(bodyText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/([.!?"]\s*)((?:Step\s*)?1[.):]\s+[A-Z])/g, '$1\n\n$2')
    .replace(/([.!?"]\s*)((?:Step\s*)?[2-9][.):]\s+[A-Z])/g, '$1\n$2');

  const lines = normalizedBody.split(/\n/);
  const parsedSteps: string[] = [];
  const introLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const stepMatch = trimmed.match(/^(?:Step\s*\d+[:.)\-]|\d+[.):\-])\s+(.+)$/i);
    if (stepMatch) {
      parsedSteps.push(stepMatch[1].trim());
    } else {
      introLines.push(rawLine);
    }
  }

  const rawIntroBlocks = introLines
    .join('\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const introParagraphs: string[] = [];
  for (const block of rawIntroBlocks) {
    const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
    if (rawIntroBlocks.length === 1 && sentences && sentences.length >= 2) {
      const firstSentence = sentences[0].trim();
      const restSentences = sentences.slice(1).join(' ').trim();
      if (firstSentence) introParagraphs.push(firstSentence);
      if (restSentences) introParagraphs.push(restSentences);
    } else {
      introParagraphs.push(block);
    }
  }

  const normalizedExplicit = Array.isArray(explicitSteps)
    ? explicitSteps
        .map((s) => {
          if (typeof s === 'string') return s.trim();
          if (s && typeof s === 'object') {
            const t = String(s.title || '').trim();
            const d = String(s.description || '').trim();
            return t && d ? `${t}: ${d}` : t || d;
          }
          return '';
        })
        .filter(Boolean)
    : [];

  const finalSteps = parsedSteps.length > 0 ? parsedSteps : normalizedExplicit;

  return {
    introParagraphs,
    steps: finalSteps,
  };
}

export function getTraderDaysSinceActive(
  user: Partial<AdminUser> | null | undefined,
  nowMs = Date.now()
): number {
  const lastSeenMs = user?.lastSeenAt ? Date.parse(user.lastSeenAt) : NaN;
  const lastLoginMs = user?.lastLoginAt ? Date.parse(user.lastLoginAt) : NaN;
  const joinedMs = user?.joinedAt ? Date.parse(user.joinedAt) : NaN;
  const latestActivityMs = [lastSeenMs, lastLoginMs, joinedMs]
    .filter((ms) => Number.isFinite(ms))
    .reduce((max, ms) => Math.max(max, ms), 0);
  if (!latestActivityMs) return 3;
  return Math.max(0, Math.floor((nowMs - latestActivityMs) / 86400000));
}

export function isTraderInactive2To3PlusDays(
  user: Partial<AdminUser> | null | undefined,
  nowMs = Date.now()
): boolean {
  const lastSeenMs = user?.lastSeenAt ? Date.parse(user.lastSeenAt) : NaN;
  const lastLoginMs = user?.lastLoginAt ? Date.parse(user.lastLoginAt) : NaN;
  const joinedMs = user?.joinedAt ? Date.parse(user.joinedAt) : NaN;
  const latestActivityMs = [lastSeenMs, lastLoginMs, joinedMs]
    .filter((ms) => Number.isFinite(ms))
    .reduce((max, ms) => Math.max(max, ms), 0);
  if (!latestActivityMs) return true;
  return nowMs - latestActivityMs >= 2 * 86400000;
}

export function formatPlatformDurationLabel(seconds: number | null | undefined): string {
  const sec = Math.max(0, Math.round(Number(seconds || 0)));
  if (sec <= 0) return '< 1m';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.max(1, Math.floor((sec % 3600) / 60));
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function personalizeClientNewsletterText(
  templateText: string,
  recipient?: Partial<AdminUser> | null
): string {
  const rawName = String(recipient?.name || 'Lerato Mokoena').trim() || 'Trader';
  const firstName = rawName.split(/\s+/)[0] || 'Trader';
  const email = String(recipient?.email || 'trader@chartreplay.co.za')
    .trim()
    .toLowerCase();
  const sessionCount = Number(recipient?.sessionCount ?? 4);
  const tradeCount = Number(recipient?.tradeCount ?? 6);
  const rawPlan =
    typeof recipient?.tradingPlanName === 'string' && recipient.tradingPlanName.trim()
      ? `"${recipient.tradingPlanName.trim()}"`
      : recipient?.hasTradingPlan
      ? 'your personal Trading Plan'
      : 'your on-chart Sticky Trading Plan';
  const joinedMs = recipient?.joinedAt ? Date.parse(recipient.joinedAt) : NaN;
  const daysNum = Number.isFinite(joinedMs)
    ? Math.max(1, Math.floor(Math.max(0, Date.now() - joinedMs) / 86400000) + 1)
    : 5;
  const daysOnPlatform = `${daysNum} ${daysNum === 1 ? 'day' : 'days'}`;

  return String(templateText ?? '')
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, rawName)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*tradingPlanName\s*\}\}/gi, rawPlan)
    .replace(/\{\{\s*sessionCount\s*\}\}/gi, String(sessionCount))
    .replace(/\{\{\s*tradeCount\s*\}\}/gi, String(tradeCount))
    .replace(/\{\{\s*daysOnPlatform\s*\}\}/gi, daysOnPlatform);
}

let previewNewslettersState: NewsletterEditionItem[] = DEFAULT_CLIENT_NEWSLETTER_TEMPLATES.map(
  (item, idx) => ({
    ...item,
    approved: idx < 3,
    approvedBy: idx < 3 ? 'admin@chartreplay.co.za' : null,
    approvedAt: idx < 3 ? new Date(Date.now() - 3600000 * 4).toISOString() : null,
    status: idx === 0 ? 'sent' : idx === 1 ? 'scheduled' : idx === 2 ? 'approved' : 'pending_approval',
    sentAt: idx === 0 ? new Date(Date.now() - 3600000 * 6).toISOString() : null,
    sentCount: idx === 0 ? 3 : 0,
    scheduledFor:
      idx === 1 ? new Date(Date.now() + 3600000 * 12).toISOString() : null,
  })
);
let previewNewsletterLogsState: NewsletterDeliveryLogItem[] = [
  {
    id: 'preview-nl-log-seed-1',
    newsletterId: 'newsletter-day-1',
    dayNumber: 1,
    badgeText: 'Prop Firm Playbook · 5 Steps',
    category: 'Prop Firm Playbook',
    subject: 'Hi Lerato — 5 Steps How to Pass a Prop Firm Challenge Without Stress',
    userEmail: 'lerato@example.com',
    userName: 'Lerato Mokoena',
    sentBy: 'Cheslin (Admin)',
    deliveryStatus: 'sent',
    sentAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    opened: true,
    firstOpenedAt: new Date(Date.now() - 3600000 * 5.2).toISOString(),
    openedAt: new Date(Date.now() - 3600000 * 4.8).toISOString(),
    openCount: 2,
    clicked: true,
    clickedAt: new Date(Date.now() - 3600000 * 4.8).toISOString(),
    clickCount: 1,
  },
  {
    id: 'preview-nl-log-seed-2',
    newsletterId: 'newsletter-day-1',
    dayNumber: 1,
    badgeText: 'Prop Firm Playbook · 5 Steps',
    category: 'Prop Firm Playbook',
    subject: 'Hi Thabo — 5 Steps How to Pass a Prop Firm Challenge Without Stress',
    userEmail: 'thabo@example.com',
    userName: 'Thabo Nkosi',
    sentBy: 'Cheslin (Admin)',
    deliveryStatus: 'sent',
    sentAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    opened: true,
    firstOpenedAt: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    openedAt: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    openCount: 1,
    clicked: false,
    clickedAt: null,
    clickCount: 0,
  },
  {
    id: 'preview-nl-log-seed-3',
    newsletterId: 'newsletter-day-3',
    dayNumber: 3,
    badgeText: 'Comeback Playbook · 3 Steps',
    category: 'Comeback Motivation (2–3+ Days Inactive)',
    subject: 'Hi Anele — We missed you on Chart Replay! 3 steps to get back in rhythm',
    userEmail: 'anele@example.com',
    userName: 'Anele Dlamini',
    sentBy: 'Cheslin (Admin)',
    deliveryStatus: 'sent',
    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    opened: false,
    firstOpenedAt: null,
    openedAt: null,
    openCount: 0,
    clicked: false,
    clickedAt: null,
    clickCount: 0,
  },
];

export async function loadAdminNewsletters(preview = false): Promise<{
  ok: boolean;
  newsletters: NewsletterEditionItem[];
  logs: NewsletterDeliveryLogItem[];
  resendConfigured: boolean;
}> {
  if (preview) {
    return {
      ok: true,
      newsletters: previewNewslettersState,
      logs: previewNewsletterLogsState,
      resendConfigured: true,
    };
  }
  try {
    const res = await platformRequest('newsletters');
    if (res.ok && Array.isArray(res.newsletters)) {
      return {
        ok: true,
        newsletters: res.newsletters as NewsletterEditionItem[],
        logs: Array.isArray(res.logs) ? (res.logs as NewsletterDeliveryLogItem[]) : [],
        resendConfigured: Boolean(res.resendConfigured),
      };
    }
  } catch {
    // fall back
  }
  return {
    ok: true,
    newsletters: DEFAULT_CLIENT_NEWSLETTER_TEMPLATES,
    logs: [],
    resendConfigured: false,
  };
}

export async function saveAdminNewsletter(
  newsletter: Partial<NewsletterEditionItem> & { id: string },
  preview = false
): Promise<{
  ok: boolean;
  newsletter?: NewsletterEditionItem;
  newsletters?: NewsletterEditionItem[];
  error?: string;
}> {
  if (preview) {
    const existing =
      previewNewslettersState.find((n) => n.id === newsletter.id) ||
      DEFAULT_CLIENT_NEWSLETTER_TEMPLATES[0];
    const updated: NewsletterEditionItem = {
      ...existing,
      ...newsletter,
      updatedAt: new Date().toISOString(),
    };
    previewNewslettersState = [
      ...previewNewslettersState.filter((n) => n.id !== newsletter.id),
      updated,
    ].sort((a, b) => a.dayNumber - b.dayNumber);
    return { ok: true, newsletter: updated, newsletters: previewNewslettersState };
  }
  const res = await platformRequest('save-newsletter', { newsletter });
  if (!res.ok) {
    return { ok: false, error: (res.error as string) || 'Unable to save newsletter.' };
  }
  return {
    ok: true,
    newsletter: res.newsletter,
    newsletters: res.newsletters,
  };
}

export async function approveAdminNewsletter(
  id: string,
  approved = true,
  preview = false
): Promise<{
  ok: boolean;
  newsletter?: NewsletterEditionItem;
  newsletters?: NewsletterEditionItem[];
  error?: string;
}> {
  if (preview) {
    const nowIso = new Date().toISOString();
    let updated: NewsletterEditionItem | undefined;
    previewNewslettersState = previewNewslettersState.map((item) => {
      if (item.id !== id) return item;
      updated = {
        ...item,
        approved,
        approvedBy: approved ? 'Dashboard preview' : null,
        approvedAt: approved ? nowIso : null,
        status: approved
          ? item.status === 'sent'
            ? 'sent'
            : item.scheduledFor
            ? 'scheduled'
            : 'approved'
          : 'pending_approval',
        scheduledFor: approved ? item.scheduledFor : null,
        updatedAt: nowIso,
      };
      return updated;
    });
    return { ok: true, newsletter: updated, newsletters: previewNewslettersState };
  }
  const res = await platformRequest('approve-newsletter', { id, approved });
  if (!res.ok) {
    return { ok: false, error: (res.error as string) || 'Unable to approve newsletter.' };
  }
  return {
    ok: true,
    newsletter: res.newsletter,
    newsletters: res.newsletters,
  };
}

export async function scheduleAdminNewsletter(
  input: {
    id: string;
    scheduledFor: string;
    cadence: NewsletterCadence;
    targetAudience: NewsletterTargetAudience;
    selectedRecipients?: string[];
    approveAndSchedule?: boolean;
  },
  preview = false
): Promise<{
  ok: boolean;
  newsletter?: NewsletterEditionItem;
  newsletters?: NewsletterEditionItem[];
  error?: string;
}> {
  if (preview) {
    const nowIso = new Date().toISOString();
    let updated: NewsletterEditionItem | undefined;
    previewNewslettersState = previewNewslettersState.map((item) => {
      if (item.id !== input.id) return item;
      updated = {
        ...item,
        approved: true,
        approvedBy: item.approvedBy || 'Dashboard preview',
        approvedAt: item.approvedAt || nowIso,
        status: 'scheduled',
        scheduledFor: input.scheduledFor,
        cadence: input.cadence,
        targetAudience: input.targetAudience,
        selectedRecipients: input.selectedRecipients || item.selectedRecipients,
        updatedAt: nowIso,
      };
      return updated;
    });
    return { ok: true, newsletter: updated, newsletters: previewNewslettersState };
  }
  const res = await platformRequest('schedule-newsletter', input);
  if (!res.ok) {
    return {
      ok: false,
      error: (res.error as string) || 'Unable to schedule newsletter.',
    };
  }
  return {
    ok: true,
    newsletter: res.newsletter,
    newsletters: res.newsletters,
  };
}

export async function scheduleAdminNewsletterSeries(
  input: {
    cadence: NewsletterCadence;
    dailyDaysCount?: number;
    startAt: string;
    targetAudience: NewsletterTargetAudience;
    selectedRecipients?: string[];
    approveAll?: boolean;
  },
  preview = false
): Promise<{
  ok: boolean;
  newsletters?: NewsletterEditionItem[];
  error?: string;
}> {
  if (preview) {
    const startMs = Date.parse(input.startAt) || Date.now() + 3600000;
    const dailyCount = input.dailyDaysCount || 5;
    const nowIso = new Date().toISOString();
    let offsetDays = 0;
    previewNewslettersState = previewNewslettersState.map((item, idx) => {
      if (item.status === 'sent') return item;
      if (idx > 0) {
        if (input.cadence === 'daily') offsetDays += 1;
        else if (input.cadence === 'every_second_day') offsetDays += 2;
        else offsetDays += idx < dailyCount ? 1 : 2;
      }
      const itemCadence: NewsletterCadence =
        input.cadence === 'daily'
          ? 'daily'
          : input.cadence === 'every_second_day'
          ? 'every_second_day'
          : idx < dailyCount
          ? 'daily'
          : 'every_second_day';
      return {
        ...item,
        approved: true,
        approvedBy: item.approvedBy || 'Dashboard preview',
        approvedAt: item.approvedAt || nowIso,
        status: 'scheduled',
        cadence: itemCadence,
        scheduledFor: new Date(startMs + offsetDays * 86400000).toISOString(),
        targetAudience: input.targetAudience,
        selectedRecipients: input.selectedRecipients || [],
        updatedAt: nowIso,
      };
    });
    return { ok: true, newsletters: previewNewslettersState };
  }
  const res = await platformRequest('schedule-newsletter-series', input);
  if (!res.ok) {
    return {
      ok: false,
      error: (res.error as string) || 'Unable to schedule newsletter series.',
    };
  }
  return {
    ok: true,
    newsletters: res.newsletters,
  };
}

export async function sendAdminNewsletterNow(
  input: {
    id: string;
    recipients?: Array<{ email: string; name: string }>;
    targetAudience?: NewsletterTargetAudience;
    isBulk?: boolean;
    approveAndSend?: boolean;
  },
  preview = false
): Promise<{
  ok: boolean;
  newsletter?: NewsletterEditionItem;
  newsletters?: NewsletterEditionItem[];
  logs?: NewsletterDeliveryLogItem[];
  results?: Array<{ email: string; name: string; subject: string; sent: boolean; logId?: string }>;
  error?: string;
}> {
  if (preview) {
    const nowIso = new Date().toISOString();
    const target = previewNewslettersState.find((n) => n.id === input.id);
    if (!target) return { ok: false, error: 'Newsletter not found.' };
    const recs =
      input.recipients && input.recipients.length > 0
        ? input.recipients
        : [{ email: 'lerato@example.com', name: 'Lerato Mokoena' }];
    const newLogs: NewsletterDeliveryLogItem[] = recs.map((r, idx) => ({
      id: `preview-nl-log-${Date.now()}-${idx}`,
      newsletterId: target.id,
      dayNumber: target.dayNumber,
      badgeText: stripClientLegacyDayPrefix(target.badgeText),
      category: target.category || target.phaseLabel,
      subject: personalizeClientNewsletterText(target.subject, r),
      userEmail: r.email,
      userName: r.name,
      sentBy: 'Cheslin (Admin)',
      deliveryStatus: 'sent',
      sentAt: nowIso,
      isBulk: Boolean(input.isBulk || recs.length > 1),
      opened: false,
      openedAt: null,
      firstOpenedAt: null,
      openCount: 0,
      clicked: false,
      clickedAt: null,
      clickCount: 0,
    }));
    previewNewsletterLogsState = [...newLogs, ...previewNewsletterLogsState];
    let updated: NewsletterEditionItem | undefined;
    previewNewslettersState = previewNewslettersState.map((item) => {
      if (item.id !== input.id) return item;
      updated = {
        ...item,
        approved: true,
        approvedBy: item.approvedBy || 'Cheslin (Admin)',
        approvedAt: item.approvedAt || nowIso,
        status: 'sent',
        sentAt: nowIso,
        sentCount: (item.sentCount || 0) + recs.length,
        updatedAt: nowIso,
      };
      return updated;
    });
    return {
      ok: true,
      newsletter: updated,
      newsletters: previewNewslettersState,
      logs: previewNewsletterLogsState,
      results: newLogs.map((l) => ({
        email: l.userEmail,
        name: l.userName,
        subject: l.subject,
        sent: true,
        logId: l.id,
      })),
    };
  }
  const res = await platformRequest('send-newsletter', input);
  if (!res.ok) {
    return {
      ok: false,
      error: (res.error as string) || 'Unable to send newsletter.',
    };
  }
  return {
    ok: true,
    newsletter: res.newsletter,
    newsletters: res.newsletters,
    logs: res.logs,
    results: res.results,
  };
}



