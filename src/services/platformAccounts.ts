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
  phaseLabel: string;
  badgeText: string;
  subject: string;
  headline: string;
  bodyText: string;
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
  subject: string;
  userEmail: string;
  userName: string;
  sentBy: string;
  deliveryStatus: string;
  sentAt: string;
}

export const DEFAULT_CLIENT_NEWSLETTER_TEMPLATES: NewsletterEditionItem[] = [
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
    approved: idx < 2,
    approvedBy: idx < 2 ? 'admin@chartreplay.co.za' : null,
    approvedAt: idx < 2 ? new Date(Date.now() - 3600000 * 4).toISOString() : null,
    status: idx === 0 ? 'scheduled' : idx === 1 ? 'approved' : 'pending_approval',
    scheduledFor:
      idx === 0 ? new Date(Date.now() + 3600000 * 12).toISOString() : null,
  })
);
let previewNewsletterLogsState: NewsletterDeliveryLogItem[] = [];

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
    approveAndSend?: boolean;
  },
  preview = false
): Promise<{
  ok: boolean;
  newsletter?: NewsletterEditionItem;
  newsletters?: NewsletterEditionItem[];
  logs?: NewsletterDeliveryLogItem[];
  results?: Array<{ email: string; name: string; subject: string; sent: boolean }>;
  error?: string;
}> {
  if (preview) {
    const nowIso = new Date().toISOString();
    const target = previewNewslettersState.find((n) => n.id === input.id);
    if (!target) return { ok: false, error: 'Newsletter not found.' };
    const recs =
      input.recipients && input.recipients.length > 0
        ? input.recipients
        : [{ email: 'trader1@example.invalid', name: 'Lerato Mokoena' }];
    const newLogs: NewsletterDeliveryLogItem[] = recs.map((r, idx) => ({
      id: `preview-nl-log-${Date.now()}-${idx}`,
      newsletterId: target.id,
      dayNumber: target.dayNumber,
      subject: personalizeClientNewsletterText(target.subject, r),
      userEmail: r.email,
      userName: r.name,
      sentBy: 'Dashboard preview',
      deliveryStatus: 'sent',
      sentAt: nowIso,
    }));
    previewNewsletterLogsState = [...newLogs, ...previewNewsletterLogsState];
    let updated: NewsletterEditionItem | undefined;
    previewNewslettersState = previewNewslettersState.map((item) => {
      if (item.id !== input.id) return item;
      updated = {
        ...item,
        approved: true,
        approvedBy: item.approvedBy || 'Dashboard preview',
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



