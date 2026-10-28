import {readAdminWaitlist} from './waitlistStore.mjs';
import {createSupabaseAccountStore} from './supabaseStore.mjs';
import {sendWelcomeEmail,sendPasswordResetEmail,isResendConfigured} from './resendMail.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID,scrypt as nodeScrypt,timingSafeEqual,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(nodeScrypt);
export const platformDataDirectory=()=>process.env.PLATFORM_DATA_DIR||path.join(homedir(),'.chart-replay');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,32);return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,encoded){try{const [kind,salt,hex]=String(encoded).split(':');if(kind!=='scrypt'||!salt||!/^[a-f0-9]{64}$/.test(hex))return false;const key=await scrypt(password,salt,32);return timingSafeEqual(key,Buffer.from(hex,'hex'));}catch{return false;}}
export const publicAccount=user=>({id:user.id,name:user.name,email:user.email,joinedAt:user.joinedAt,loginCount:user.loginCount||0,lastLoginAt:user.lastLoginAt||null,lastSeenAt:user.lastSeenAt||null,sessionCount:typeof user.sessionCount==='number'?user.sessionCount:Array.isArray(user.sessionIds)?user.sessionIds.length:0,source:'server',plan:'FREE_FOREVER',...(user.hasTradingPlan!==undefined?{hasTradingPlan:Boolean(user.hasTradingPlan),tradingPlanName:user.tradingPlanName||null,tradingPlanCount:Number(user.tradingPlanCount||0),tradeCount:Number(user.tradeCount||0)}:{})});
export const DEFAULT_SPONSORSHIP={
 enabled:true,
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
  enabled:typeof obj.enabled==='boolean'?obj.enabled:true,
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
 return {read,change,readSponsorship,saveSponsorship,config:async()=>JSON.parse(await readFile(path.join(directory,'admin.json'),'utf8'))};
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
 const visitors=new Map();
 const online=()=>{const cutoff=now()-120000;for(const[id,visit]of visitors)if(visit.seen<cutoff)visitors.delete(id);return {onlineVisitors:visitors.size,onlineAccounts:new Set([...visitors.values()].map(v=>v.userId).filter(Boolean)).size};};
 const limited=(key,max)=>{const time=now();for(const [entry,value]of attempts)if(value.until<=time)attempts.delete(entry);if(attempts.size>20000)return true;const value=attempts.get(key)||{count:0,until:time+15*60*1000};value.count++;attempts.set(key,value);return value.count>max;};
 const findUserById=async id=>typeof store.findById==='function'?store.findById(id):(await store.read()).find(u=>u.id===id)||null;
 const findUserByEmail=async email=>typeof store.findByEmail==='function'?store.findByEmail(email):(await store.read()).find(u=>u.email===email)||null;
 const updateUserPassword=async(userId,passwordHash,nowIso)=>typeof store.updatePassword==='function'?store.updatePassword(userId,passwordHash,nowIso):store.change(users=>{const u=users.find(item=>item.id===userId);if(!u)return null;u.passwordHash=passwordHash;u.lastSeenAt=nowIso;return u;});
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
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
  if(!enabled)return send(503,{error:'The local administrator service is not configured.'});
  const cookie=String(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('chart_replay_admin='))?.slice('chart_replay_admin='.length);
  const admin=hasAdmin&&validAdminSession(cookie,config,now());
  if(req.method==='GET'&&action==='session')return admin?send(200,{admin:{email:config.email}}):send(401,{error:'Administrator sign-in required.'});
  if(req.method==='GET'&&action==='waitlist'){if(!admin)return send(401,{error:'Administrator sign-in required.'});try{return send(200,await waitlistReader());}catch{return send(503,{error:'The waiting list is temporarily unavailable.'});}}
  if(req.method==='GET'&&action==='users'){if(!admin)return send(401,{error:'Administrator sign-in required.'});try{return send(200,{users:(await store.read()).map(publicAccount),activity:online(),scope});}catch{return send(503,{error:'User records are temporarily unavailable.'});}}
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{error:'Method not allowed.'});}
  try{
   if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Please use this website to continue.'});
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Use the sign-in form.'});
   const bodyLimit=action==='sponsorship'?1572864:action==='activity'?131072:4096;
   let body=req.body;
   if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>bodyLimit)return send(413,{error:'Request too large.'});}body=raw;}
   if(typeof body==='string'){if(Buffer.byteLength(body)>bodyLimit)return send(413,{error:'Request too large.'});try{body=JSON.parse(body);}catch{return send(400,{error:'Invalid form data.'});}}
   if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>bodyLimit)return send(400,{error:'Invalid form data.'});
   const secure=req.socket?.encrypted||req.headers['x-forwarded-proto']==='https';
   const cookieOptions=`Path=/api/platform; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
   const userCookieOptions=`Path=/api/platform; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
   const setUserCookie=user=>res.setHeader('Set-Cookie',`chart_replay_user=${createUserSession(user.id,config,now())}; ${userCookieOptions}; Max-Age=28800`);
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
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const password=typeof body.password==='string'?body.password:'';
   const ip=req.socket?.remoteAddress||'local';
   if(limited(`${action}:${ip}`,action==='admin-login'||action==='request-password-reset'||action==='reset-password'?10:120)){res.setHeader('Retry-After','900');return send(429,{error:'Too many attempts. Please try again in fifteen minutes.'});}
   if(action==='admin-login'){
    if(!hasAdmin||password.length>256||email!==config.email||!await verifyPassword(password,config.passwordHash))return send(401,{error:'Incorrect administrator email or password.'});
    res.setHeader('Set-Cookie',`chart_replay_admin=${createAdminSession(config,now())}; ${cookieOptions}; Max-Age=28800`);return send(200,{admin:{email:config.email}});
   }
   if(action==='request-password-reset'){
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(400,{error:'Please enter a valid email address.'});
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
    const result=publicAccount(updated);
    setUserCookie(result);
    return send(200,{ok:true,user:result});
   }
   if(action!=='register'&&action!=='login')return send(404,{error:'Unknown action.'});
   if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<4||password.length>256)return send(400,{error:'Enter a valid email address and password.'});
   if(action==='register'){
    const name=typeof body.name==='string'?body.name.trim():'';
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
   if(!found||!await verifyPassword(password,found.passwordHash))return send(401,{error:'Incorrect email or password.'});
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
 return sealToken({role:'user',userId,expires:now+8*3600000},config.sessionSecret);
}
export function readUserSession(token,config,now=Date.now()){
 const value=openToken(token,config?.sessionSecret);
 return value&&value.role==='user'&&typeof value.userId==='string'&&value.expires>now?value.userId:null;
}
