import {readAdminWaitlist} from './waitlistStore.mjs';
import {createSupabaseAccountStore,hasSqlInjectionPattern,isSafeEmailFormat,isSafeIdentifier} from './supabaseStore.mjs';
import {sendWelcomeEmail,sendPasswordResetEmail,sendFirstTradeFeedbackEmail,sendContactInquiryEmail,sendFeedbackNotificationEmail,DEFAULT_NEWSLETTER_TEMPLATES,buildPersonalizedNewsletterEmail,sendPersonalizedNewsletterEmail,CONTACT_INQUIRY_RECIPIENT,formatContactCategoryLabel,resolvePublicAppUrl,isResendConfigured} from './resendMail.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID,scrypt as nodeScrypt,timingSafeEqual,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {promisify} from 'node:util';
export {hasSqlInjectionPattern,isSafeEmailFormat,isSafeIdentifier};
export const LOGIN_MAX_FAILURES=3;
export const LOGIN_LOCKOUT_MS=30*1000;
const scrypt=promisify(nodeScrypt);
export const platformDataDirectory=()=>process.env.PLATFORM_DATA_DIR||path.join(homedir(),'.chart-replay');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,32);return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,encoded){try{const [kind,salt,hex]=String(encoded).split(':');if(kind!=='scrypt'||!salt||!/^[a-f0-9]{64}$/.test(hex))return false;const key=await scrypt(password,salt,32);return timingSafeEqual(key,Buffer.from(hex,'hex'));}catch{return false;}}
export const publicAccount=user=>({id:user.id,name:user.name,email:user.email,joinedAt:user.joinedAt,loginCount:user.loginCount||0,lastLoginAt:user.lastLoginAt||null,lastSeenAt:user.lastSeenAt||null,sessionCount:typeof user.sessionCount==='number'?user.sessionCount:Array.isArray(user.sessionIds)?user.sessionIds.filter(id=>!String(id||'').startsWith('__meta_')).length:0,source:'server',plan:'FREE_FOREVER',...(user.emailUnsubscribed?{emailUnsubscribed:true}:{}),...(user.hasTradingPlan!==undefined?{hasTradingPlan:Boolean(user.hasTradingPlan),tradingPlanName:user.tradingPlanName||null,tradingPlanCount:Number(user.tradingPlanCount||0),tradeCount:Number(user.tradeCount||0)}:{})});
export function adminAccountProjection(user,nowMs=Date.now(),onlineUserIds=new Set()){
 const pub=publicAccount(user);
 const joinedMs=user.joinedAt?Date.parse(String(user.joinedAt)):NaN;
 const loginMs=user.lastLoginAt?Date.parse(String(user.lastLoginAt)):NaN;
 const seenMs=user.lastSeenAt?Date.parse(String(user.lastSeenAt)):NaN;
 const isOnlineNow=Boolean(onlineUserIds.has(user.id)||(Number.isFinite(seenMs)&&nowMs-seenMs>=0&&nowMs-seenMs<=120000));
 let currentSessionSeconds=0;
 if(Number.isFinite(loginMs)){
  if(isOnlineNow){
   currentSessionSeconds=Math.max(60,Math.min(86400,Math.round(Math.max(0,nowMs-loginMs)/1000)));
  }else if(Number.isFinite(seenMs)&&seenMs>=loginMs){
   currentSessionSeconds=Math.max(60,Math.min(86400,Math.round((seenMs-loginMs)/1000)));
  }else{
   currentSessionSeconds=Math.max(60,(Number(pub.sessionCount||0)>0?420:120));
  }
 }
 const rawTrackedActive=Number(user.totalActiveSeconds||0);
 const estimatedMinActive=(Number(pub.sessionCount||0)*600)+(Number(pub.tradeCount||0)*180)+(Number(pub.loginCount||0)*120);
 const totalTimeOnPlatformSeconds=Math.max(rawTrackedActive,currentSessionSeconds,estimatedMinActive);
 const platformMemberDurationSeconds=Number.isFinite(joinedMs)?Math.max(60,Math.round(Math.max(0,nowMs-joinedMs)/1000)):0;
 return {
  ...pub,
  isOnlineNow,
  currentSessionSeconds,
  totalTimeOnPlatformSeconds,
  platformMemberDurationSeconds,
 };
}
export const DEFAULT_SPONSORSHIP={
 enabled:false,
 sponsorName:'XM',
 badgeText:'Official Session Partner',
 headlinePrefix:"Today's session is sponsored by",
 subtext:'Preparing your chart workspace for',
 footerLeftText:'Loading candles & analysis tools…',
 footerRightText:'Click anywhere to skip',
 accentColor:'#e11d24',
 logoLightUrl:'/xm-logo-light.png',
 logoDarkUrl:'/xm-logo-dark.png',
};
const SAFE_DATA_IMAGE_RE=/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
function isSafeLogoUrl(url){
 if(typeof url!=='string')return false;
 const trimmed=url.trim();
 if(!trimmed||trimmed.length>750000)return false;
 if(trimmed.startsWith('/'))return !trimmed.startsWith('//')&&!/[\x00-\x1f"<>\s]/.test(trimmed);
 if(SAFE_DATA_IMAGE_RE.test(trimmed))return true;
 try{const parsed=new URL(trimmed);return parsed.protocol==='https:'||parsed.protocol==='http:';}catch{return false;}
}
function cleanText(value,fallback,max=120){
 if(typeof value!=='string')return fallback;
 const cleaned=value.replace(/[\x00-\x1f\x7f]/g,'').trim();
 return cleaned?cleaned.slice(0,max):fallback;
}
export function sanitizeSponsorship(raw,updatedBy='admin',nowMs=Date.now()){
 const obj=raw&&typeof raw==='object'?raw:{};
 const light=isSafeLogoUrl(obj.logoLightUrl)?obj.logoLightUrl.trim():DEFAULT_SPONSORSHIP.logoLightUrl;
 const dark=isSafeLogoUrl(obj.logoDarkUrl)?obj.logoDarkUrl.trim():isSafeLogoUrl(obj.logoLightUrl)?obj.logoLightUrl.trim():DEFAULT_SPONSORSHIP.logoDarkUrl;
 const color=typeof obj.accentColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(obj.accentColor.trim())?obj.accentColor.trim().toLowerCase():DEFAULT_SPONSORSHIP.accentColor;
 return {
  enabled:typeof obj.enabled==='boolean'?obj.enabled:false,
  sponsorName:cleanText(obj.sponsorName,DEFAULT_SPONSORSHIP.sponsorName,80),
  badgeText:cleanText(obj.badgeText,DEFAULT_SPONSORSHIP.badgeText,80),
  headlinePrefix:cleanText(obj.headlinePrefix,DEFAULT_SPONSORSHIP.headlinePrefix,140),
  subtext:cleanText(obj.subtext,DEFAULT_SPONSORSHIP.subtext,160),
  footerLeftText:cleanText(obj.footerLeftText,DEFAULT_SPONSORSHIP.footerLeftText,100),
  footerRightText:cleanText(obj.footerRightText,DEFAULT_SPONSORSHIP.footerRightText,100),
  accentColor:color,
  logoLightUrl:light,
  logoDarkUrl:dark,
  updatedBy:cleanText(updatedBy,'admin',120),
  updatedAt:new Date(nowMs).toISOString(),
 };
}
function sealToken(obj,secret){
 const key=createHash('sha256').update(String(secret)).digest();
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 const enc=Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
 const tag=cipher.getAuthTag();
 return `${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
}
function openToken(token,secret){
 try{
  const [ivB64,encB64,tagB64,...extra]=String(token).split('.');
  if(!ivB64||!encB64||!tagB64||extra.length)return null;
  const key=createHash('sha256').update(String(secret)).digest();
  const iv=Buffer.from(ivB64,'base64url');
  const tag=Buffer.from(tagB64,'base64url');
  if(iv.length!==12||tag.length!==16)return null;
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAuthTag(tag);
  const dec=Buffer.concat([decipher.update(Buffer.from(encB64,'base64url')),decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
 }catch{return null;}
}
export function createFileAccountStore(directory){
 let pending=Promise.resolve();
 const read=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'users.json'),'utf8'));if(!Array.isArray(data))throw Error('Invalid account data');return data;}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const change=operation=>{const work=pending.then(async()=>{const users=await read();const result=await operation(users);await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`users-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(users,null,2),{mode:0o600});await rename(temporary,path.join(directory,'users.json'));return result;});pending=work.catch(()=>{});return work;};
 const readSponsorship=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'sponsorship.json'),'utf8'));return sanitizeSponsorship(data,data?.updatedBy||'admin');}catch(error){if(error.code==='ENOENT')return {...DEFAULT_SPONSORSHIP};throw error;}};
 const saveSponsorship=async(sponsorship)=>{const sanitized=sanitizeSponsorship(sponsorship,sponsorship?.updatedBy||'admin');await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`sponsorship-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(sanitized,null,2),{mode:0o600});await rename(temporary,path.join(directory,'sponsorship.json'));return sanitized;};
 const readFeedback=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'feedback.json'),'utf8'));return Array.isArray(data)?data:[];}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const saveFeedback=async(entry)=>{const list=await readFeedback();const next=[entry,...list.filter(item=>item&&item.id!==entry.id)].slice(0,500);await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`feedback-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(next,null,2),{mode:0o600});await rename(temporary,path.join(directory,'feedback.json'));return entry;};
 const readFeedbackEmails=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'feedback-emails.json'),'utf8'));return Array.isArray(data)?data:[];}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const recordFeedbackEmail=async(entry)=>{const list=await readFeedbackEmails();const next=[entry,...list.filter(item=>item&&item.id!==entry.id)].slice(0,500);await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`feedback-emails-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(next,null,2),{mode:0o600});await rename(temporary,path.join(directory,'feedback-emails.json'));return entry;};
 const readContactInquiries=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'contact-inquiries.json'),'utf8'));return Array.isArray(data)?data:[];}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const saveContactInquiry=async(entry)=>{const list=await readContactInquiries();const next=[entry,...list.filter(item=>item&&item.id!==entry.id)].slice(0,500);await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`contact-inquiries-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(next,null,2),{mode:0o600});await rename(temporary,path.join(directory,'contact-inquiries.json'));return entry;};
 const readNewsletters=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'newsletters.json'),'utf8'));return Array.isArray(data)?data:[];}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const saveNewsletters=async(items)=>{const list=Array.isArray(items)?items:[];await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`newsletters-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(list,null,2),{mode:0o600});await rename(temporary,path.join(directory,'newsletters.json'));return list;};
 const readNewsletterLogs=async()=>{try{const data=JSON.parse(await readFile(path.join(directory,'newsletter-logs.json'),'utf8'));return Array.isArray(data)?data:[];}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const recordNewsletterLog=async(entry)=>{const list=await readNewsletterLogs();const next=[entry,...list.filter(item=>item&&item.id!==entry.id)].slice(0,500);await mkdir(directory,{recursive:true,mode:0o700});const temporary=path.join(directory,`newsletter-logs-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(next,null,2),{mode:0o600});await rename(temporary,path.join(directory,'newsletter-logs.json'));return entry;};
 return {read,change,readSponsorship,saveSponsorship,readFeedback,saveFeedback,readFeedbackEmails,recordFeedbackEmail,readContactInquiries,saveContactInquiry,readNewsletters,saveNewsletters,readNewsletterLogs,recordNewsletterLog,config:async()=>JSON.parse(await readFile(path.join(directory,'admin.json'),'utf8'))};
}
export function createAdminSession(config,now=Date.now()){
 return sealToken({role:'admin',email:config.email,expires:now+8*3600*1000,nonce:randomBytes(12).toString('hex')},config.sessionSecret);
}
export function validAdminSession(token,config,now=Date.now()){
 const value=openToken(token,config?.sessionSecret);
 return Boolean(value&&value.role==='admin'&&value.email===config.email&&value.expires>now);
}
export function createPlatformHandler({store=createSupabaseAccountStore({fallbackStore:createFileAccountStore(platformDataDirectory())}),now=()=>Date.now(),waitlistReader=readAdminWaitlist,env=process.env,request=fetch}={}){
 const attempts=new Map();
 const loginLockouts=new Map();
 const visitors=new Map();
 const online=()=>{const cutoff=now()-120000;for(const[id,visit]of visitors)if(visit.seen<cutoff)visitors.delete(id);return {onlineVisitors:visitors.size,onlineAccounts:new Set([...visitors.values()].map(v=>v.userId).filter(Boolean)).size};};
 const limited=(key,max)=>{const time=now();for(const [entry,value]of attempts)if(value.until<=time)attempts.delete(entry);if(attempts.size>20000)return true;const value=attempts.get(key)||{count:0,until:time+15*60*1000};value.count++;attempts.set(key,value);return value.count>max;};
 const clientIp=req=>{const xff=req?.headers?.['x-forwarded-for'];if(typeof xff==='string'&&xff.trim()){return xff.split(',')[0].trim().slice(0,80);}return String(req?.socket?.remoteAddress||'local').slice(0,80);};
 const lockoutKeys=(scopeKey,ip,email)=>{const keys=[`${scopeKey}:ip:${ip}`];if(email)keys.push(`${scopeKey}:email:${email.slice(0,160)}`);return keys;};
 const pruneLockouts=time=>{for(const[k,v]of loginLockouts){if((v.lockedUntil&&v.lockedUntil<=time)||(time-(v.lastFailAt||0)>15*60*1000&&!v.lockedUntil))loginLockouts.delete(k);}};
 const getLoginLockout=(scopeKey,ip,email)=>{
  const time=now();
  pruneLockouts(time);
  let maxLockedUntil=0;
  let maxFails=0;
  for(const key of lockoutKeys(scopeKey,ip,email)){
   const entry=loginLockouts.get(key);
   if(!entry)continue;
   if(entry.lockedUntil>time&&entry.lockedUntil>maxLockedUntil)maxLockedUntil=entry.lockedUntil;
   if(entry.fails>maxFails)maxFails=entry.fails;
  }
  if(maxLockedUntil>time){
   const retryAfterSeconds=Math.max(1,Math.ceil((maxLockedUntil-time)/1000));
   return {locked:true,lockedUntil:maxLockedUntil,retryAfterSeconds,failedAttempts:LOGIN_MAX_FAILURES,remainingAttempts:0};
  }
  return {locked:false,lockedUntil:0,retryAfterSeconds:0,failedAttempts:maxFails,remainingAttempts:Math.max(0,LOGIN_MAX_FAILURES-maxFails)};
 };
 const recordLoginFailure=(scopeKey,ip,email)=>{
  const time=now();
  pruneLockouts(time);
  if(loginLockouts.size>20000)loginLockouts.clear();
  let maxFails=0;
  let maxLockedUntil=0;
  for(const key of lockoutKeys(scopeKey,ip,email)){
   const prev=loginLockouts.get(key);
   const fails=(prev&&(!prev.lockedUntil||prev.lockedUntil>time)?prev.fails:0)+1;
   const lockedUntil=fails>=LOGIN_MAX_FAILURES?time+LOGIN_LOCKOUT_MS:0;
   loginLockouts.set(key,{fails,lockedUntil,lastFailAt:time});
   if(fails>maxFails)maxFails=fails;
   if(lockedUntil>maxLockedUntil)maxLockedUntil=lockedUntil;
  }
  if(maxLockedUntil>time){
   const retryAfterSeconds=Math.max(1,Math.ceil((maxLockedUntil-time)/1000));
   return {locked:true,lockedUntil:maxLockedUntil,retryAfterSeconds,failedAttempts:maxFails,remainingAttempts:0};
  }
  return {locked:false,lockedUntil:0,retryAfterSeconds:0,failedAttempts:maxFails,remainingAttempts:Math.max(0,LOGIN_MAX_FAILURES-maxFails)};
 };
 const clearLoginLockout=(scopeKey,ip,email)=>{
  for(const key of lockoutKeys(scopeKey,ip,email))loginLockouts.delete(key);
 };
 const findUserById=async id=>typeof store.findById==='function'?store.findById(id):(await store.read()).find(u=>u.id===id)||null;
 const findUserByEmail=async email=>typeof store.findByEmail==='function'?store.findByEmail(email):(await store.read()).find(u=>u.email===email)||null;
 const updateUserPassword=async(userId,passwordHash,nowIso)=>typeof store.updatePassword==='function'?store.updatePassword(userId,passwordHash,nowIso):store.change(users=>{const u=users.find(item=>item.id===userId);if(!u)return null;u.passwordHash=passwordHash;u.lastSeenAt=nowIso;return u;});
 const sanitizeNewsletterItem=(raw,fallback={})=>{
  const obj=raw&&typeof raw==='object'?raw:{};
  const base=fallback&&typeof fallback==='object'?fallback:{};
  const cadenceVal=['daily','every_second_day','daily_then_every_second_day'].includes(obj.cadence)?obj.cadence:base.cadence||'daily';
  const dayNumber=Math.max(1,Math.min(365,Number(obj.dayNumber??base.dayNumber??1)||1));
  const approved=Boolean(obj.approved??base.approved??false);
  let status=typeof obj.status==='string'?obj.status:(base.status||'pending_approval');
  if(!['pending_approval','approved','scheduled','sent'].includes(status)){
   status=approved?'approved':'pending_approval';
  }
  if(!approved&&status==='scheduled')status='pending_approval';
  const targetAudience=['all','active','new_starters','selected'].includes(obj.targetAudience)?obj.targetAudience:(base.targetAudience||'all');
  const selectedRecipients=Array.isArray(obj.selectedRecipients)?obj.selectedRecipients.map(e=>String(e||'').trim().toLowerCase()).filter(Boolean).slice(0,500):Array.isArray(base.selectedRecipients)?base.selectedRecipients:[];
  return {
   id:cleanText(obj.id,base.id||`newsletter-${randomUUID()}`,100),
   dayNumber,
   cadence:cadenceVal,
   phaseLabel:cleanText(obj.phaseLabel,base.phaseLabel||(cadenceVal==='daily'?`Beginning · Daily Habit (Day ${dayNumber})`:`Every 2nd Day · Pro Progression (Day ${dayNumber})`),120),
   badgeText:cleanText(obj.badgeText,base.badgeText||`Day ${dayNumber} · Trader Motivation`,100),
   subject:cleanText(obj.subject,base.subject||'Hi {{firstName}} — Daily Trader Motivation',200),
   headline:cleanText(obj.headline,base.headline||'Hi {{firstName}}, stay disciplined and trade your plan.',240),
   bodyText:cleanText(obj.bodyText,base.bodyText||'Every session on Chart Replay builds your edge.',4000),
   actionTip:cleanText(obj.actionTip,base.actionTip||'Review your sticky trading plan before placing your first trade today.',1000),
   ctaText:cleanText(obj.ctaText,base.ctaText||'Open Your Trading Workspace →',100),
   status,
   approved,
   approvedBy:approved?cleanText(obj.approvedBy,base.approvedBy||'admin',120):null,
   approvedAt:approved?(obj.approvedAt||base.approvedAt||new Date(now()).toISOString()):null,
   scheduledFor:obj.scheduledFor||base.scheduledFor||null,
   targetAudience,
   selectedRecipients,
   sentAt:obj.sentAt||base.sentAt||null,
   sentCount:Number(obj.sentCount??base.sentCount??0)||0,
   updatedAt:obj.updatedAt||base.updatedAt||new Date(now()).toISOString(),
  };
 };
 const loadMergedNewsletters=async()=>{
  const stored=typeof store.readNewsletters==='function'?await store.readNewsletters().catch(()=>[]):[];
  const byId=new Map();
  for(const tpl of DEFAULT_NEWSLETTER_TEMPLATES){
   byId.set(tpl.id,sanitizeNewsletterItem(tpl,tpl));
  }
  if(Array.isArray(stored)){
   for(const item of stored){
    if(item&&item.id){
     const base=byId.get(item.id)||{};
     byId.set(item.id,sanitizeNewsletterItem(item,base));
    }
   }
  }
  return Array.from(byId.values()).sort((a,b)=>(a.dayNumber||0)-(b.dayNumber||0));
 };
 const resolveNewsletterRecipients=(newsletter,allUsers,explicitRecipients)=>{
  const unsubscribedEmails=new Set(allUsers.filter(u=>u&&u.emailUnsubscribed).map(u=>String(u.email||'').toLowerCase()));
  if(Array.isArray(explicitRecipients)&&explicitRecipients.length>0){
   const byEmail=new Map(allUsers.map(u=>[String(u.email||'').toLowerCase(),u]));
   return explicitRecipients
    .map(r=>{
     const email=typeof r==='string'?r.trim().toLowerCase():String(r?.email||'').trim().toLowerCase();
     if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return null;
     if(unsubscribedEmails.has(email))return null;
     const existing=byEmail.get(email);
     if(existing){
      if(existing.emailUnsubscribed)return null;
      return publicAccount(existing);
     }
     return {
      id:`recipient-${email}`,
      name:cleanText(r?.name,'Trader',80),
      email,
      joinedAt:r?.joinedAt||new Date(now()).toISOString(),
      sessionCount:Number(r?.sessionCount||0),
      tradeCount:Number(r?.tradeCount||0),
      hasTradingPlan:Boolean(r?.hasTradingPlan),
      tradingPlanName:r?.tradingPlanName||null,
     };
    })
    .filter(Boolean)
    .slice(0,200);
  }
  const pubUsers=allUsers.filter(u=>!u?.emailUnsubscribed).map(publicAccount).filter(u=>u.email&&!u.emailUnsubscribed&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email));
  if(newsletter.targetAudience==='selected'&&Array.isArray(newsletter.selectedRecipients)&&newsletter.selectedRecipients.length>0){
   const set=new Set(newsletter.selectedRecipients.map(e=>e.toLowerCase()));
   return pubUsers.filter(u=>set.has(u.email.toLowerCase()));
  }
  if(newsletter.targetAudience==='new_starters'){
   const sevenDaysAgo=now()-7*86400000;
   return pubUsers.filter(u=>(Date.parse(u.joinedAt||'')||0)>=sevenDaysAgo);
  }
  if(newsletter.targetAudience==='active'){
   return pubUsers.filter(u=>(u.sessionCount||0)>0||(u.tradeCount||0)>0||(u.loginCount||0)>1);
  }
  return pubUsers;
 };
 const dispatchNewsletterItem=async(newsletter,allUsers,{explicitRecipients,sentBy='admin',origin}={})=>{
  const recipients=resolveNewsletterRecipients(newsletter,allUsers,explicitRecipients);
  const results=[];
  const nowIso=new Date(now()).toISOString();
  for(const recipient of recipients){
   let sentResult={sent:false,reason:'RESEND_NOT_CONFIGURED'};
   const previewMail=buildPersonalizedNewsletterEmail({newsletter,recipient,nowMs:now()});
   if(isResendConfigured(env)){
    sentResult=await sendPersonalizedNewsletterEmail({newsletter,recipient,origin,nowMs:now()},{env,request}).catch(err=>({sent:false,error:err?.message||String(err)}));
   }
   const logEntry={
    id:randomUUID(),
    newsletterId:newsletter.id,
    dayNumber:newsletter.dayNumber,
    subject:previewMail.subject,
    userEmail:recipient.email,
    userName:recipient.name,
    sentBy,
    deliveryStatus:sentResult.sent?'sent':isResendConfigured(env)?'failed':'queued_ready',
    sentAt:nowIso,
   };
   if(typeof store.recordNewsletterLog==='function'){
    await store.recordNewsletterLog(logEntry).catch(()=>{});
   }
   results.push({
    email:recipient.email,
    name:recipient.name,
    subject:previewMail.subject,
    sent:Boolean(sentResult.sent),
    error:sentResult.error||null,
    logEntry,
   });
  }
  return {results,sentAt:nowIso,sentCount:results.length};
 };
 const processDueNewsletters=async(newsletters,origin,adminEmail='scheduler')=>{
  const curMs=now();
  const due=newsletters.filter(n=>n.approved&&n.status==='scheduled'&&n.scheduledFor&&(Date.parse(n.scheduledFor)||Infinity)<=curMs);
  if(due.length===0)return newsletters;
  const allUsers=await store.read().catch(()=>[]);
  let changed=false;
  const updated=await Promise.all(newsletters.map(async item=>{
   if(!due.some(d=>d.id===item.id))return item;
   const dispatchRes=await dispatchNewsletterItem(item,allUsers,{sentBy:adminEmail,origin});
   changed=true;
   return {
    ...item,
    status:'sent',
    sentAt:dispatchRes.sentAt,
    sentCount:(Number(item.sentCount||0))+dispatchRes.sentCount,
    updatedAt:dispatchRes.sentAt,
   };
  }));
  if(changed&&typeof store.saveNewsletters==='function'){
   await store.saveNewsletters(updated).catch(()=>{});
  }
  return updated;
 };
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  const sendLockout=lockState=>{
   res.setHeader('Retry-After',String(lockState.retryAfterSeconds));
   return send(429,{
    error:`Too many failed login attempts (${LOGIN_MAX_FAILURES}/${LOGIN_MAX_FAILURES}). Account login is locked for ${lockState.retryAfterSeconds} seconds — please wait before trying again.`,
    lockedOut:true,
    lockedUntil:lockState.lockedUntil,
    retryAfterSeconds:lockState.retryAfterSeconds,
    remainingAttempts:0,
   });
  };
  const url=new URL(req.url,'http://localhost');const action=url.searchParams.get('action')||'status';
  // File store is local-only; Supabase store supports both local and hosted environments.
  const local=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host||'')&&!process.env.VERCEL;
  const scope=store.remote?'supabase':'localhost';
  if(req.method==='GET'&&action==='sponsorship'){
   try{
    const sponsorship=typeof store.readSponsorship==='function'?await store.readSponsorship():null;
    return send(200,{ok:true,sponsorship:sponsorship||DEFAULT_SPONSORSHIP,scope});
   }catch{
    return send(200,{ok:true,sponsorship:DEFAULT_SPONSORSHIP,scope});
   }
  }
  let config;try{config=await store.config();}catch{}
  const hasAdmin=Boolean(config?.email&&config?.passwordHash&&config?.sessionSecret);
  const enabled=(local||Boolean(store.remote))&&Boolean(config?.sessionSecret&&(hasAdmin||config?.userAuthEnabled));
  if(req.method==='GET'&&action==='status'){
   const userToken=enabled?String(req.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('chart_replay_user='))?.slice(18):null;
   const userId=userToken?readUserSession(userToken,config,now()):null;
   let activeUser=null;
   if(userId){try{const found=await findUserById(userId);if(found)activeUser=publicAccount(found);}catch{}}
   return send(200,activeUser?{enabled,scope,user:activeUser}:{enabled,scope});
  }
  const applySubscriptionChange=async(targetEmail,unsubscribed)=>{
   const clean=String(targetEmail||'').trim().toLowerCase();
   if(!isSafeEmailFormat(clean))return {ok:false,error:'Please provide a valid email address.'};
   const nowIso=new Date(now()).toISOString();
   try{
    await store.change(users=>{
     const u=users.find(item=>String(item.email||'').toLowerCase()===clean);
     if(u){
      if(unsubscribed){
       u.emailUnsubscribed=true;
       u.unsubscribedAt=nowIso;
      }else{
       delete u.emailUnsubscribed;
       delete u.unsubscribedAt;
      }
      u.lastSeenAt=nowIso;
     }
    });
   }catch{
    // ignore store error if local store is unconfigured
   }
   return {ok:true,email:clean,unsubscribed:Boolean(unsubscribed),updatedAt:nowIso};
  };
  if(req.method==='GET'&&(action==='unsubscribe'||action==='resubscribe')){
   const queryEmail=url.searchParams.get('email')||'';
   const subRes=await applySubscriptionChange(queryEmail,action==='unsubscribe');
   if(!subRes.ok)return send(400,{error:subRes.error});
   return send(200,{...subRes,scope});
  }
  if(!enabled&&action!=='submit-feedback'&&action!=='submit-contact'&&action!=='unsubscribe'&&action!=='resubscribe')return send(503,{error:'The local administrator service is not configured.'});
  const cookie=String(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('chart_replay_admin='))?.slice('chart_replay_admin='.length);
  const admin=hasAdmin&&validAdminSession(cookie,config,now());
  if(req.method==='GET'&&action==='session')return admin?send(200,{admin:{email:config.email}}):send(401,{error:'Administrator sign-in required.'});
  if(req.method==='GET'&&action==='waitlist'){if(!admin)return send(401,{error:'Administrator sign-in required.'});try{return send(200,await waitlistReader());}catch{return send(503,{error:'The waiting list is temporarily unavailable.'});}}
  if(req.method==='GET'&&action==='users'){if(!admin)return send(401,{error:'Administrator sign-in required.'});try{const act=online();const onlineIds=new Set([...visitors.values()].map(v=>v.userId).filter(Boolean));const curNow=now();return send(200,{users:(await store.read()).map(u=>adminAccountProjection(u,curNow,onlineIds)),activity:act,scope});}catch{return send(503,{error:'User records are temporarily unavailable.'});}}
  if(req.method==='GET'&&(action==='feedback'||action==='contact-inquiries')){if(!admin)return send(401,{error:'Administrator sign-in required.'});try{const [feedback,emailLogs,contactInquiries]=await Promise.all([typeof store.readFeedback==='function'?store.readFeedback():[],typeof store.readFeedbackEmails==='function'?store.readFeedbackEmails():[],typeof store.readContactInquiries==='function'?store.readContactInquiries():[]]);return send(200,{ok:true,feedback:feedback||[],emailLogs:emailLogs||[],contactInquiries:contactInquiries||[],resendConfigured:isResendConfigured(env),scope});}catch{return send(503,{error:'Feedback records are temporarily unavailable.'});}}
  if(req.method==='GET'&&action==='newsletters'){
   if(!admin)return send(401,{error:'Administrator sign-in required.'});
   try{
    const initialNewsletters=await loadMergedNewsletters();
    const newsletters=await processDueNewsletters(initialNewsletters,req.headers.origin,config?.email||'admin');
    const logs=typeof store.readNewsletterLogs==='function'?await store.readNewsletterLogs().catch(()=>[]):[];
    return send(200,{ok:true,newsletters,logs:logs||[],resendConfigured:isResendConfigured(env),scope});
   }catch{
    return send(503,{error:'Newsletter records are temporarily unavailable.'});
   }
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{error:'Method not allowed.'});}
  try{
   if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Please use this website to continue.'});
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Use the sign-in form.'});
   const bodyLimit=action==='sponsorship'?1572864:action==='activity'||action.includes('newsletter')?131072:16384;
   let body=req.body;
   if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>bodyLimit)return send(413,{error:'Request too large.'});}body=raw;}
   if(typeof body==='string'){if(Buffer.byteLength(body)>bodyLimit)return send(413,{error:'Request too large.'});try{body=JSON.parse(body);}catch{return send(400,{error:'Invalid form data.'});}}
   if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>bodyLimit)return send(400,{error:'Invalid form data.'});
   const secure=req.socket?.encrypted||req.headers['x-forwarded-proto']==='https';
   const cookieOptions=`Path=/api/platform; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
   const userCookieOptions=`Path=/api/platform; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
   const setUserCookie=user=>res.setHeader('Set-Cookie',`chart_replay_user=${createUserSession(user.id,config,now())}; ${userCookieOptions}; Max-Age=2592000`);
   if(action==='admin-impersonate'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can log into a user account.'});
    const targetId=typeof body.userId==='string'?body.userId.trim():'';
    const targetEmail=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const targetName=typeof body.name==='string'?body.name.trim():'Trader';
    if(!targetId&&!targetEmail)return send(400,{error:'Target user ID or email is required.'});
    let targetUser=targetId?await findUserById(targetId):null;
    if(!targetUser&&targetEmail)targetUser=await findUserByEmail(targetEmail);
    if(!targetUser){
     targetUser={
      id:targetId||randomUUID(),
      name:targetName||(targetEmail.split('@')[0]||'Trader'),
      email:targetEmail||'trader@chartreplay.co.za',
      joinedAt:new Date(now()).toISOString(),
      loginCount:1,
      lastLoginAt:new Date(now()).toISOString(),
     };
    }
    const pub=publicAccount(targetUser);
    setUserCookie(pub);
    return send(200,{ok:true,user:pub,impersonatedBy:config.email,scope});
   }
   if(action==='save-newsletter'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can edit newsletters.'});
    const list=await loadMergedNewsletters();
    const rawItem=body.newsletter&&typeof body.newsletter==='object'?body.newsletter:body;
    const itemId=typeof rawItem.id==='string'&&rawItem.id.trim()?rawItem.id.trim():`newsletter-${randomUUID()}`;
    const existing=list.find(n=>n.id===itemId)||{};
    const updatedItem=sanitizeNewsletterItem({...existing,...rawItem,id:itemId,updatedAt:new Date(now()).toISOString()},existing);
    const nextList=[...list.filter(n=>n.id!==itemId),updatedItem].sort((a,b)=>(a.dayNumber||0)-(b.dayNumber||0));
    if(typeof store.saveNewsletters==='function'){
     await store.saveNewsletters(nextList);
    }
    return send(200,{ok:true,newsletter:updatedItem,newsletters:nextList,scope});
   }
   if(action==='approve-newsletter'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can approve newsletters.'});
    const list=await loadMergedNewsletters();
    const targetId=typeof body.id==='string'?body.id.trim():'';
    if(!targetId)return send(400,{error:'Newsletter ID is required.'});
    const approveFlag=body.approved!==false;
    const nowIso=new Date(now()).toISOString();
    let updatedItem=null;
    const nextList=list.map(item=>{
     if(item.id!==targetId)return item;
     const nextStatus=approveFlag?(item.status==='sent'?'sent':item.scheduledFor?'scheduled':'approved'):'pending_approval';
     updatedItem={
      ...item,
      approved:approveFlag,
      approvedBy:approveFlag?(config?.email||'admin'):null,
      approvedAt:approveFlag?nowIso:null,
      status:nextStatus,
      scheduledFor:approveFlag?item.scheduledFor:null,
      updatedAt:nowIso,
     };
     return updatedItem;
    });
    if(!updatedItem)return send(404,{error:'Newsletter not found.'});
    if(typeof store.saveNewsletters==='function'){
     await store.saveNewsletters(nextList);
    }
    return send(200,{ok:true,newsletter:updatedItem,newsletters:nextList,scope});
   }
   if(action==='schedule-newsletter'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can schedule newsletters.'});
    const list=await loadMergedNewsletters();
    const targetId=typeof body.id==='string'?body.id.trim():'';
    if(!targetId)return send(400,{error:'Newsletter ID is required.'});
    const existing=list.find(n=>n.id===targetId);
    if(!existing)return send(404,{error:'Newsletter not found.'});
    const isApproved=Boolean(existing.approved||body.approveAndSchedule);
    if(!isApproved){
     return send(400,{error:'Administrator approval is required before scheduling a newsletter.'});
    }
    const scheduledFor=typeof body.scheduledFor==='string'&&Number.isFinite(Date.parse(body.scheduledFor))?new Date(Date.parse(body.scheduledFor)).toISOString():new Date(now()+86400000).toISOString();
    const cadence=['daily','every_second_day','daily_then_every_second_day'].includes(body.cadence)?body.cadence:existing.cadence||'daily';
    const targetAudience=['all','active','new_starters','selected'].includes(body.targetAudience)?body.targetAudience:existing.targetAudience||'all';
    const selectedRecipients=Array.isArray(body.selectedRecipients)?body.selectedRecipients.map(e=>String(e||'').trim().toLowerCase()).filter(Boolean):existing.selectedRecipients||[];
    const nowIso=new Date(now()).toISOString();
    const updatedItem=sanitizeNewsletterItem({
     ...existing,
     approved:true,
     approvedBy:existing.approvedBy||config?.email||'admin',
     approvedAt:existing.approvedAt||nowIso,
     status:'scheduled',
     scheduledFor,
     cadence,
     targetAudience,
     selectedRecipients,
     updatedAt:nowIso,
    },existing);
    const nextList=list.map(n=>n.id===targetId?updatedItem:n);
    if(typeof store.saveNewsletters==='function'){
     await store.saveNewsletters(nextList);
    }
    return send(200,{ok:true,newsletter:updatedItem,newsletters:nextList,scope});
   }
   if(action==='schedule-newsletter-series'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can schedule the newsletter series.'});
    const list=await loadMergedNewsletters();
    const cadenceMode=['daily','every_second_day','daily_then_every_second_day'].includes(body.cadence)?body.cadence:'daily_then_every_second_day';
    const dailyDaysCount=Math.max(1,Math.min(14,Number(body.dailyDaysCount)||5));
    const startMs=typeof body.startAt==='string'&&Number.isFinite(Date.parse(body.startAt))?Date.parse(body.startAt):now()+3600000;
    const targetAudience=['all','active','new_starters','selected'].includes(body.targetAudience)?body.targetAudience:'all';
    const selectedRecipients=Array.isArray(body.selectedRecipients)?body.selectedRecipients.map(e=>String(e||'').trim().toLowerCase()).filter(Boolean):[];
    const approveAll=body.approveAll!==false;
    const nowIso=new Date(now()).toISOString();
    let offsetDays=0;
    const nextList=list.map((item,idx)=>{
     if(item.status==='sent')return item;
     const isApproved=Boolean(item.approved||approveAll);
     if(!isApproved)return item;
     if(idx>0){
      if(cadenceMode==='daily'){
       offsetDays+=1;
      }else if(cadenceMode==='every_second_day'){
       offsetDays+=2;
      }else{
       offsetDays+=idx<dailyDaysCount?1:2;
      }
     }
     const itemCadence=cadenceMode==='daily'?'daily':cadenceMode==='every_second_day'?'every_second_day':idx<dailyDaysCount?'daily':'every_second_day';
     return sanitizeNewsletterItem({
      ...item,
      approved:true,
      approvedBy:item.approvedBy||config?.email||'admin',
      approvedAt:item.approvedAt||nowIso,
      status:'scheduled',
      cadence:itemCadence,
      scheduledFor:new Date(startMs+offsetDays*86400000).toISOString(),
      targetAudience,
      selectedRecipients,
      updatedAt:nowIso,
     },item);
    });
    if(typeof store.saveNewsletters==='function'){
     await store.saveNewsletters(nextList);
    }
    return send(200,{ok:true,newsletters:nextList,cadence:cadenceMode,scope});
   }
   if(action==='send-newsletter'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can send newsletters.'});
    const list=await loadMergedNewsletters();
    const targetId=typeof body.id==='string'?body.id.trim():'';
    if(!targetId)return send(400,{error:'Newsletter ID is required.'});
    const existing=list.find(n=>n.id===targetId);
    if(!existing)return send(404,{error:'Newsletter not found.'});
    if(!existing.approved&&!body.approveAndSend){
     return send(400,{error:'Please approve this newsletter before sending it to traders.'});
    }
    const allUsers=await store.read().catch(()=>[]);
    const explicitRecipients=Array.isArray(body.recipients)&&body.recipients.length>0?body.recipients:null;
    const dispatchRes=await dispatchNewsletterItem(existing,allUsers,{
     explicitRecipients,
     sentBy:config?.email||'admin',
     origin:req.headers.origin,
    });
    const nowIso=dispatchRes.sentAt;
    const updatedItem=sanitizeNewsletterItem({
     ...existing,
     approved:true,
     approvedBy:existing.approvedBy||config?.email||'admin',
     approvedAt:existing.approvedAt||nowIso,
     status:'sent',
     sentAt:nowIso,
     sentCount:(Number(existing.sentCount||0))+dispatchRes.sentCount,
     updatedAt:nowIso,
    },existing);
    const nextList=list.map(n=>n.id===targetId?updatedItem:n);
    if(typeof store.saveNewsletters==='function'){
     await store.saveNewsletters(nextList);
    }
    const logs=typeof store.readNewsletterLogs==='function'?await store.readNewsletterLogs().catch(()=>[]):[];
    return send(200,{
     ok:true,
     newsletter:updatedItem,
     newsletters:nextList,
     results:dispatchRes.results,
     logs,
     resendConfigured:isResendConfigured(env),
     scope,
    });
   }
   if(action==='send-feedback-email'){
    if(!admin)return send(401,{error:'Only the signed-in administrator can send feedback emails.'});
    const allUsers=await store.read().catch(()=>[]);
    const unsubscribedEmails=new Set(allUsers.filter(u=>u&&u.emailUnsubscribed).map(u=>String(u.email||'').toLowerCase()));
    const rawRecipients=Array.isArray(body.recipients)?body.recipients:body.email?[{email:body.email,name:body.name}]:[];
    const recipients=rawRecipients
     .map(r=>({
      email:typeof r?.email==='string'?r.email.trim().toLowerCase():'',
      name:cleanText(r?.name,'Trader',80),
     }))
     .filter(r=>r.email&&!unsubscribedEmails.has(r.email)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
     .slice(0,50);
    if(recipients.length===0)return send(400,{error:'Please select at least one valid subscribed user email address.'});
    const appUrl=resolvePublicAppUrl(req.headers.origin,env);
    const results=[];
    for(const recipient of recipients){
     const feedbackUrl=`${appUrl}/?feedback=1&email=${encodeURIComponent(recipient.email)}&name=${encodeURIComponent(recipient.name)}`;
     let sentResult={sent:false,reason:'RESEND_NOT_CONFIGURED',feedbackUrl};
     if(isResendConfigured(env)){
      sentResult=await sendFirstTradeFeedbackEmail({name:recipient.name,email:recipient.email,origin:req.headers.origin},{env,request});
     }
     const logEntry={
      id:randomUUID(),
      userEmail:recipient.email,
      userName:recipient.name,
      sentBy:config?.email||'admin',
      deliveryStatus:sentResult.sent?'sent':isResendConfigured(env)?'failed':'link_ready',
      sentAt:new Date(now()).toISOString(),
     };
     if(typeof store.recordFeedbackEmail==='function'){
      await store.recordFeedbackEmail(logEntry).catch(()=>{});
     }
     results.push({
      email:recipient.email,
      name:recipient.name,
      sent:Boolean(sentResult.sent),
      error:sentResult.error||null,
      feedbackUrl:sentResult.feedbackUrl||feedbackUrl,
      logEntry,
     });
    }
    return send(200,{ok:true,results,resendConfigured:isResendConfigured(env),scope});
   }
   if(action==='unsubscribe'||action==='resubscribe'){
    const targetEmail=typeof body.email==='string'?body.email.trim().toLowerCase():url.searchParams.get('email')||'';
    const subRes=await applySubscriptionChange(targetEmail,action==='unsubscribe');
    if(!subRes.ok)return send(400,{error:subRes.error});
    return send(200,{...subRes,scope});
   }
   if(action==='submit-feedback'){
    const fbEmail=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const fbName=cleanText(body.name,'Trader',80);
    const rUserFriendliness=Number(body.ratingUserFriendliness);
    const rCharts=Number(body.ratingCharts);
    const rSmoothness=Number(body.ratingSmoothness);
    if(
     !Number.isInteger(rUserFriendliness)||rUserFriendliness<1||rUserFriendliness>5||
     !Number.isInteger(rCharts)||rCharts<1||rCharts>5||
     !Number.isInteger(rSmoothness)||rSmoothness<1||rSmoothness>5
    ){
     return send(400,{error:'Please select a star rating from 1 to 5 for User Friendliness, Charts, and Smoothness.'});
    }
    const improvementsText=cleanText(body.improvementsText,'',2000);
    const favoriteText=cleanText(body.favoriteText,'',1000);
    const matchedUser=fbEmail?await findUserByEmail(fbEmail).catch(()=>null):null;
    const overallRating=Number(((rUserFriendliness+rCharts+rSmoothness)/3).toFixed(2));
    const entry={
     id:typeof body.id==='string'&&/^[0-9a-f-]{36}$/i.test(body.id)?body.id:randomUUID(),
     userId:matchedUser?.id||null,
     userEmail:fbEmail||'anonymous@chartreplay.co.za',
     userName:matchedUser?.name||fbName,
     ratingUserFriendliness:rUserFriendliness,
     ratingCharts:rCharts,
     ratingSmoothness:rSmoothness,
     overallRating,
     improvementsText,
     favoriteText,
     source:cleanText(body.source,'email_link',40),
     createdAt:new Date(now()).toISOString(),
    };
    const saved=typeof store.saveFeedback==='function'?await store.saveFeedback(entry):entry;
    let emailSent=false;
    if(isResendConfigured(env)){
     const notifyRes=await sendFeedbackNotificationEmail({
      name:entry.userName,
      email:entry.userEmail,
      ratingUserFriendliness:entry.ratingUserFriendliness,
      ratingCharts:entry.ratingCharts,
      ratingSmoothness:entry.ratingSmoothness,
      overallRating:entry.overallRating,
      improvementsText:entry.improvementsText,
      favoriteText:entry.favoriteText,
      source:entry.source,
      origin:req.headers.origin,
     },{env,request}).catch(()=>({sent:false}));
     emailSent=Boolean(notifyRes?.sent);
    }
    return send(201,{ok:true,feedback:saved,emailSent,recipientEmail:CONTACT_INQUIRY_RECIPIENT,scope});
   }
   if(action==='submit-contact'){
    const contactEmail=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const contactName=cleanText(body.name,'Trader',80);
    const rawCategory=typeof body.category==='string'?body.category.trim().toLowerCase():'general_inquiry';
    const allowedCategories=new Set(['general_inquiry','partnership','improvement','bug']);
    const normalizedCategory=rawCategory==='inquiry'||rawCategory==='general'?'general_inquiry':rawCategory==='partner'?'partnership':allowedCategories.has(rawCategory)?rawCategory:'general_inquiry';
    const messageText=cleanText(body.message,'',4000);
    if(!isSafeEmailFormat(contactEmail)){
     return send(400,{error:'Please enter a valid email address so we can reply to you.'});
    }
    if(!messageText||messageText.length<2){
     return send(400,{error:'Please enter your message or inquiry details.'});
    }
    if(hasSqlInjectionPattern(contactName)||hasSqlInjectionPattern(messageText)||(typeof body.subject==='string'&&hasSqlInjectionPattern(body.subject))){
     return send(400,{error:'Invalid input detected. SQL or script expressions are not allowed.'});
    }
    const categoryLabel=formatContactCategoryLabel(normalizedCategory);
    const subjectText=cleanText(body.subject,`${categoryLabel} from ${contactName}`,160);
    const matchedUser=await findUserByEmail(contactEmail).catch(()=>null);
    const createdAtIso=new Date(now()).toISOString();
    const recipientEmail=String(env.CONTACT_RECIPIENT_EMAIL||CONTACT_INQUIRY_RECIPIENT).trim().toLowerCase()||CONTACT_INQUIRY_RECIPIENT;
    let sentResult={sent:false,recipientEmail};
    if(isResendConfigured(env)){
     sentResult=await sendContactInquiryEmail({
      name:matchedUser?.name||contactName,
      email:contactEmail,
      category:normalizedCategory,
      subject:subjectText,
      message:messageText,
      createdAt:createdAtIso,
      origin:req.headers.origin,
     },{env,request}).catch(()=>({sent:false,recipientEmail}));
    }
    const inquiryEntry={
     id:typeof body.id==='string'&&/^[0-9a-f-]{36}$/i.test(body.id)?body.id:randomUUID(),
     userId:matchedUser?.id||body.userId||null,
     userEmail:contactEmail,
     userName:matchedUser?.name||contactName,
     category:normalizedCategory,
     subject:subjectText,
     message:messageText,
     recipientEmail:sentResult.recipientEmail||recipientEmail,
     emailSent:Boolean(sentResult.sent),
     source:cleanText(body.source,'contact_page',40),
     createdAt:createdAtIso,
    };
    const saved=typeof store.saveContactInquiry==='function'?await store.saveContactInquiry(inquiryEntry):inquiryEntry;
    return send(201,{ok:true,inquiry:saved,emailSent:Boolean(sentResult.sent),recipientEmail:inquiryEntry.recipientEmail,scope});
   }
   if(action==='sponsorship'){
    if(!admin)return send(401,{error:'Administrator sign-in required.'});
    const candidate=body.sponsorship&&typeof body.sponsorship==='object'?body.sponsorship:body;
    if(candidate.logoLightUrl!==undefined&&!isSafeLogoUrl(candidate.logoLightUrl))return send(400,{error:'Invalid sponsor logo image or URL.'});
    if(candidate.logoDarkUrl!==undefined&&!isSafeLogoUrl(candidate.logoDarkUrl))return send(400,{error:'Invalid dark-theme sponsor logo image or URL.'});
    const sanitized=sanitizeSponsorship(candidate,config.email,now());
    const saved=typeof store.saveSponsorship==='function'?await store.saveSponsorship(sanitized):sanitized;
    return send(200,{ok:true,sponsorship:saved,scope});
   }
   if(action==='user-logout'){res.setHeader('Set-Cookie',`chart_replay_user=; ${userCookieOptions}; Max-Age=0`);return send(200,{ok:true});}
   if(action==='activity'){
    if(!/^[a-f0-9-]{36}$/i.test(body.visitorId||''))return send(400,{error:'Invalid visitor identifier.'});
    const userToken=String(req.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('chart_replay_user='))?.slice(18);
    const userId=readUserSession(userToken,config,now());
    const accountId=body.accountId===userId?userId:null;
    if(body.sessionIds!==undefined&&(!Array.isArray(body.sessionIds)||body.sessionIds.length>1000||body.sessionIds.some(id=>typeof id!=='string'||id.length>150)))return send(400,{error:'Invalid session list.'});
    online();if(visitors.size>=10000&&!visitors.has(body.visitorId))return send(429,{error:'Visitor capacity reached.'});
    visitors.set(body.visitorId,{seen:now(),userId:accountId});
    if(typeof store.recordPresence==='function')void store.recordPresence(body.visitorId,accountId,now());
    if(accountId){
     if(typeof store.touchUserActivity==='function'){
      await store.touchUserActivity(accountId,body.sessionIds||[],now());
     }else{
      await store.change(users=>{const user=users.find(u=>u.id===accountId);if(user){user.lastSeenAt=new Date(now()).toISOString();user.sessionIds=[...new Set([...(user.sessionIds||[]),...(body.sessionIds||[]).filter(id=>!/^session-(normal|prop)-/.test(id))])].slice(0,10000);}});
     }
    }
    return send(200,{ok:true});
   }
   if(action==='admin-logout'){res.setHeader('Set-Cookie',`chart_replay_admin=; ${cookieOptions}; Max-Age=0`);return send(200,{ok:true});}
   const rawEmail=typeof body.email==='string'?body.email.trim():'';
   const email=rawEmail.toLowerCase();
   const password=typeof body.password==='string'?body.password:'';
   const rawName=typeof body.name==='string'?body.name.trim():'';
   const ip=clientIp(req);
   if(action==='login'||action==='admin-login'){
    const lockScope=action==='admin-login'?'admin':'user';
    const currentLock=getLoginLockout(lockScope,ip,email);
    if(currentLock.locked)return sendLockout(currentLock);
   }
   if(hasSqlInjectionPattern(rawEmail)||hasSqlInjectionPattern(password)||hasSqlInjectionPattern(rawName)||(typeof body.token==='string'&&hasSqlInjectionPattern(body.token))){
    if(action==='login'||action==='admin-login'){
     const lockScope=action==='admin-login'?'admin':'user';
     const failState=recordLoginFailure(lockScope,ip,email);
     if(failState.locked)return sendLockout(failState);
     return send(400,{
      error:`Invalid input detected. SQL or script expressions are not allowed. (${failState.remainingAttempts} ${failState.remainingAttempts===1?'attempt':'attempts'} remaining before 30s lockout)`,
      lockedOut:false,
      remainingAttempts:failState.remainingAttempts,
     });
    }
    return send(400,{error:'Invalid input detected. SQL or script expressions are not allowed.'});
   }
   if(limited(`${action}:${ip}`,action==='admin-login'||action==='request-password-reset'||action==='reset-password'?25:120)){res.setHeader('Retry-After','900');return send(429,{error:'Too many attempts. Please try again in fifteen minutes.'});}
   if(action==='admin-login'){
    if(!hasAdmin||!isSafeEmailFormat(email)||password.length>256||email!==config.email||!await verifyPassword(password,config.passwordHash)){
     const failState=recordLoginFailure('admin',ip,email);
     if(failState.locked)return sendLockout(failState);
     return send(401,{
      error:`Incorrect administrator email or password. (${failState.remainingAttempts} ${failState.remainingAttempts===1?'attempt':'attempts'} remaining before 30s lockout)`,
      lockedOut:false,
      remainingAttempts:failState.remainingAttempts,
     });
    }
    clearLoginLockout('admin',ip,email);
    res.setHeader('Set-Cookie',`chart_replay_admin=${createAdminSession(config,now())}; ${cookieOptions}; Max-Age=28800`);return send(200,{admin:{email:config.email}});
   }
   if(action==='request-password-reset'){
    if(!isSafeEmailFormat(email))return send(400,{error:'Please enter a valid email address.'});
    if(!isResendConfigured(env))return send(503,{error:'Email delivery is not configured on this server yet.'});
    const found=await findUserByEmail(email);
    if(found){
     const resetToken=createPasswordResetToken(found,config,now());
     await sendPasswordResetEmail({name:found.name,email:found.email,resetToken,origin:req.headers.origin},{env,request});
    }
    // Always return the same success response to prevent account enumeration
    return send(200,{ok:true,emailSent:true,message:'If an account exists for that email address, we have sent a password reset link.'});
   }
   if(action==='reset-password'){
    const token=typeof body.token==='string'?body.token.trim():'';
    if(!token)return send(400,{error:'Invalid or missing password reset link. Please request a new reset email.'});
    if(password.length<4||password.length>256)return send(400,{error:'New password must be between 4 and 256 characters.'});
    const parsed=readPasswordResetToken(token,config,now());
    if(!parsed)return send(400,{error:'This password reset link is invalid or has expired. Please request a new reset email.'});
    const found=await findUserById(parsed.userId);
    if(!found||digestPasswordVerifier(found.passwordHash)!==parsed.pwdDigest){
     return send(400,{error:'This password reset link has already been used or is no longer valid. Please request a new link.'});
    }
    const newHash=await hashPassword(password);
    const time=new Date(now()).toISOString();
    const updated=await updateUserPassword(found.id,newHash,time);
    if(!updated)return send(404,{error:'Account not found.'});
    clearLoginLockout('user',ip,found.email);
    const result=publicAccount(updated);
    setUserCookie(result);
    return send(200,{ok:true,user:result});
   }
   if(action!=='register'&&action!=='login')return send(404,{error:'Unknown action.'});
   if(action==='login'&&(!isSafeEmailFormat(email)||password.length<1||password.length>256)){
    const failState=recordLoginFailure('user',ip,email);
    if(failState.locked)return sendLockout(failState);
    return send(401,{
     error:`Incorrect email or password. (${failState.remainingAttempts} ${failState.remainingAttempts===1?'attempt':'attempts'} remaining before 30s lockout)`,
     lockedOut:false,
     remainingAttempts:failState.remainingAttempts,
    });
   }
   if(!isSafeEmailFormat(email)||password.length<4||password.length>256)return send(400,{error:'Enter a valid email address and password.'});
   if(action==='register'){
    const name=rawName;
    if(!name||name.length>80||/[\x00-\x1f]/.test(name)||password.length<4)return send(400,{error:'Use a name of up to 80 characters and a password of at least four characters.'});
    const passwordHash=await hashPassword(password);
    const time=new Date(now()).toISOString();
    const newUser={id:randomUUID(),name,email,passwordHash,joinedAt:time,loginCount:1,lastLoginAt:time};
    const created=typeof store.createUser==='function'
     ?await store.createUser(newUser)
     :await store.change(users=>{if(users.some(user=>user.email===email))return null;users.push(newUser);return newUser;});
    if(!created)return send(409,{error:'An account with this email already exists. Please sign in.'});
    if(isResendConfigured(env)){
     await sendWelcomeEmail({name:created.name,email:created.email,origin:req.headers.origin},{env,request}).catch(()=>{});
    }
    const result=publicAccount(created);
    setUserCookie(result);return send(201,{user:result,welcomeEmailSent:isResendConfigured(env)});
   }
   const found=await findUserByEmail(email);
   if(!found||!await verifyPassword(password,found.passwordHash)){
    const failState=recordLoginFailure('user',ip,email);
    if(failState.locked)return sendLockout(failState);
    return send(401,{
     error:`Incorrect email or password. (${failState.remainingAttempts} ${failState.remainingAttempts===1?'attempt':'attempts'} remaining before 30s lockout)`,
     lockedOut:false,
     remainingAttempts:failState.remainingAttempts,
    });
   }
   clearLoginLockout('user',ip,email);
   const time=new Date(now()).toISOString();
   const updated=typeof store.recordLogin==='function'
    ?await store.recordLogin(found,time)
    :await store.change(users=>{const current=users.find(item=>item.id===found.id);if(!current)return null;current.loginCount=(current.loginCount||0)+1;current.lastLoginAt=time;return current;});
   const user=updated?publicAccount(updated):null;
   if(user)setUserCookie(user);
   return user?send(200,{user}):send(401,{error:'Incorrect email or password.'});
  }catch{return send(503,{error:'The account service is temporarily unavailable. Please try again.'});}
 };
}

function digestPasswordVerifier(passwordHash){
 return createHash('sha256').update(String(passwordHash||'')).digest('hex').slice(0,24);
}
export function createPasswordResetToken(user,config,now=Date.now()){
 return sealToken({role:'password-reset',userId:user.id,email:String(user.email||'').toLowerCase(),pwdDigest:digestPasswordVerifier(user.passwordHash),expires:now+30*60*1000,nonce:randomBytes(8).toString('hex')},config.sessionSecret);
}
export function readPasswordResetToken(token,config,now=Date.now()){
 const value=openToken(token,config?.sessionSecret);
 return value&&value.role==='password-reset'&&typeof value.userId==='string'&&typeof value.email==='string'&&typeof value.pwdDigest==='string'&&value.expires>now?value:null;
}

// Separate encrypted user sessions prevent activity from being attributed by a supplied email or ID and hide identifiers in cookies.
export function createUserSession(userId,config,now=Date.now()){
 return sealToken({role:'user',userId,expires:now+30*86400000},config.sessionSecret);
}
export function readUserSession(token,config,now=Date.now()){
 const value=openToken(token,config?.sessionSecret);
 return value&&value.role==='user'&&typeof value.userId==='string'&&value.expires>now?value.userId:null;
}
