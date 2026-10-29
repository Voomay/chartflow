import {getRegisteredUsers,setActiveLoggedInUser,purgeBrowserSensitiveStorage,RegisteredUser} from './storageAndAnalytics';
import {
  submitPlatformFeedbackToSupabase,
  fetchPlatformFeedbackFromSupabase,
  fetchFeedbackEmailLogsFromSupabase,
  PlatformFeedbackItem,
  FeedbackEmailLogItem,
} from './supabaseClient';
export interface AdminUser {id:string;name:string;email:string;joinedAt:string;loginCount:number|null;lastLoginAt:string|null;lastSeenAt?:string|null;sessionCount?:number|null;tradeCount?:number|null;hasTradingPlan?:boolean;tradingPlanName?:string|null;tradingPlanCount?:number|null;source:'server'|'browser';}
export function localAdminProfiles():AdminUser[]{return getRegisteredUsers().filter(user=>user.id!=='user-demo-trader'&&user.authSource!=='server').map(user=>({id:user.id,name:user.name,email:user.email,joinedAt:user.joinedAt,loginCount:user.loginCount??null,lastLoginAt:user.lastLoginAt??null,source:'browser'}));}
export async function platformRequest(action:string,body?:object){
 const response=await fetch(`/api/platform?action=${encodeURIComponent(action)}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',signal:AbortSignal.timeout(15000)}:{credentials:'same-origin',signal:AbortSignal.timeout(15000)});
 const data=await response.json();return {ok:response.ok,status:response.status,...data};
}
export async function serverAccountRequest(action:'register'|'login',body:{name?:string;email:string;password:string}){
 const result=await platformRequest(action,body);
 if(result.status===503&&String(result.error||'').toLowerCase().includes('not configured')){
  return {available:false,ok:false,user:undefined as RegisteredUser|undefined,error:undefined as string|undefined,welcomeEmailSent:false};
 }
 if(result.status>=500)throw Error('Account service unavailable. Please try again.');
 if(!result.ok||!result.user)return {available:true,ok:false,user:undefined as RegisteredUser|undefined,error:result.error as string,welcomeEmailSent:false};
 const user:RegisteredUser={...result.user,authSource:'server',passwordHash:''};
 purgeBrowserSensitiveStorage();
 setActiveLoggedInUser(user);return {available:true,ok:true,user,error:undefined,welcomeEmailSent:Boolean(result.welcomeEmailSent)};
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
    };
  }

  const [serverRes, directFeedback, directLogs] = await Promise.allSettled([
    platformRequest('feedback'),
    fetchPlatformFeedbackFromSupabase(),
    fetchFeedbackEmailLogsFromSupabase(),
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

  return {
    ok: true,
    feedback: Array.from(feedbackMap.values()).sort(
      (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
    ),
    emailLogs: Array.from(logMap.values()).sort(
      (a, b) => (Date.parse(b.sentAt || '') || 0) - (Date.parse(a.sentAt || '') || 0)
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

