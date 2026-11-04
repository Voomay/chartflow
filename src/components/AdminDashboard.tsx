import {AdminAnalytics} from './AdminAnalytics';
import {AdminWaitlist} from './AdminWaitlist';
import {AdminSponsorship} from './AdminSponsorship';
import {AdminFeedback} from './AdminFeedback';
import {AdminNewsletter} from './AdminNewsletter';
import {AdminPagination} from './AdminPagination';
import {pageOf} from '../services/adminReporting';
import {FormEvent,useCallback,useEffect,useMemo,useState,useRef} from 'react';
import {ArrowLeft,ArrowUpRight,CalendarDays,Check,Clock3,Eye,EyeOff,Handshake,KeyRound,LogIn,LogOut,Mail,MessageSquareHeart,Newspaper,RefreshCw,Search,ShieldCheck,Users,UserPlus} from 'lucide-react';
import {ChartReplayLogo} from './ChartReplayLogo';
import {AdminUser,formatPlatformDurationLabel,localAdminProfiles,platformRequest,sendAdminFeedbackEmails} from '../services/platformAccounts';

const allowPreview=import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
const previewUsers=():AdminUser[]=>Array.from({length:47},(_,index)=>{
 const joinedMs=Date.now()-(index<8?index:10+(index-8)*8)*86400000;
 const loginCount=Math.max(1,24-index%24);
 const sessionCount=Math.max(1,12-index%12);
 const tradeCount=index%3===0?3:index%2===0?1:0;
 const currentSessionSeconds=Math.max(300,(18-(index%14))*180);
 const totalTimeOnPlatformSeconds=Math.max(currentSessionSeconds,sessionCount*900+loginCount*240);
 const platformMemberDurationSeconds=Math.max(3600,Math.round((Date.now()-joinedMs)/1000));
 return {
  id:`preview-${index}`,
  name:['Lerato Mokoena','James Smith','Aisha Khan','Thabo Dlamini','Sarah Williams','Daniel Adams'][index%6]+(index>5?` ${index+1}`:''),
  email:`trader${index+1}@example.invalid`,
  joinedAt:new Date(joinedMs).toISOString(),
  loginCount,
  sessionCount,
  tradeCount,
  hasTradingPlan:index%2===0,
  tradingPlanName:index%2===0?'ICT Silver Bullet Plan':null,
  lastLoginAt:new Date(Date.now()-(index%3===1?Math.max(2,index%6)*86400000:index*3600000)).toISOString(),
  lastSeenAt:new Date(Date.now()-(index%3===1?Math.max(2,index%6)*86400000:index*1800000)).toISOString(),
  isOnlineNow:index<3,
  currentSessionSeconds,
  totalTimeOnPlatformSeconds,
  platformMemberDurationSeconds,
  source:'server',
 };
});

const localDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const dateLabel=(value:string|null,withTime=false)=>!value?'Not recorded':new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit',hourCycle:'h23' as const}:{})}).format(new Date(value));
const computeUserPlatformTiming=(user:AdminUser)=>{
 const nowMs=Date.now();
 const joinedMs=user.joinedAt?Date.parse(user.joinedAt):NaN;
 const loginMs=user.lastLoginAt?Date.parse(user.lastLoginAt):NaN;
 const seenMs=user.lastSeenAt?Date.parse(user.lastSeenAt):NaN;
 const isOnline=Boolean(user.isOnlineNow||(Number.isFinite(seenMs)&&nowMs-seenMs>=0&&nowMs-seenMs<=120000));
 const sessionSec=typeof user.currentSessionSeconds==='number'&&user.currentSessionSeconds>0
  ?user.currentSessionSeconds
  :Number.isFinite(loginMs)
  ?isOnline
   ?Math.max(60,Math.round(Math.max(0,nowMs-loginMs)/1000))
   :Number.isFinite(seenMs)&&seenMs>=loginMs
   ?Math.max(60,Math.round((seenMs-loginMs)/1000))
   :Math.max(120,(user.sessionCount||1)*300)
  :0;
 const totalActiveSec=typeof user.totalTimeOnPlatformSeconds==='number'&&user.totalTimeOnPlatformSeconds>0
  ?user.totalTimeOnPlatformSeconds
  :Math.max(sessionSec,((user.sessionCount||0)*600)+((user.tradeCount||0)*180)+((user.loginCount||0)*120));
 const memberSec=typeof user.platformMemberDurationSeconds==='number'&&user.platformMemberDurationSeconds>0
  ?user.platformMemberDurationSeconds
  :Number.isFinite(joinedMs)
  ?Math.max(60,Math.round(Math.max(0,nowMs-joinedMs)/1000))
  :60;
 return {isOnline,sessionSec,totalActiveSec,memberSec};
};

export function AdminDashboard({onBack,onLoginAsUser}:{onBack:()=>void;onLoginAsUser?:(user:AdminUser,preview:boolean)=>Promise<void>|void}){
 const [preview]=useState(()=>allowPreview&&new URLSearchParams(window.location.search).get('preview')==='1');
 const [admin,setAdmin]=useState<string|null>(preview?'Dashboard preview':null);const[checking,setChecking]=useState(!preview);const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[showPassword,setShowPassword]=useState(false);const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 const [adminLockoutUntil,setAdminLockoutUntil]=useState<number>(0);
 const [adminNowMs,setAdminNowMs]=useState<number>(()=>Date.now());
 const adminLockSecondsLeft=adminLockoutUntil>adminNowMs?Math.max(1,Math.ceil((adminLockoutUntil-adminNowMs)/1000)):0;
 useEffect(()=>{
  if(adminLockoutUntil<=Date.now()){
   if(adminLockoutUntil!==0){setAdminLockoutUntil(0);setError(prev=>prev.toLowerCase().includes('locked')?'':prev);}
   return;
  }
  setAdminNowMs(Date.now());
  const id=window.setInterval(()=>{
   const cur=Date.now();
   setAdminNowMs(cur);
   if(cur>=adminLockoutUntil){setAdminLockoutUntil(0);setError(prev=>prev.toLowerCase().includes('locked')?'':prev);window.clearInterval(id);}
  },250);
  return()=>window.clearInterval(id);
 },[adminLockoutUntil]);
 const[activity,setActivity]=useState({onlineVisitors:0,onlineAccounts:0});const[scope,setScope]=useState<'supabase'|'localhost'>('localhost');const[rows,setRows]=useState<AdminUser[]>([]);const[updated,setUpdated]=useState<string|null>(null);const[query,setQuery]=useState('');const[filter,setFilter]=useState('all');const[tab,setTab]=useState<'overview'|'newsletter'|'analytics'|'users'|'feedback'|'waitlist'|'sponsorship'>('overview');
 const[impersonatingId,setImpersonatingId]=useState<string|null>(null);
 const[quickEmailStatus,setQuickEmailStatus]=useState<{email:string;message:string;url?:string}|null>(null);
 const handleImpersonate=useCallback(async(user:AdminUser)=>{
  if(!onLoginAsUser)return;
  setImpersonatingId(user.id);
  setError('');
  try{
   await onLoginAsUser(user,preview);
  }catch(reason){
   setError(reason instanceof Error?reason.message:'Unable to log into user account.');
  }finally{
   setImpersonatingId(null);
  }
 },[onLoginAsUser,preview]);
 const handleQuickSendFeedbackEmail=useCallback(async(user:AdminUser)=>{
  setQuickEmailStatus({email:user.email,message:'Sending feedback email…'});
  try{
   const res=await sendAdminFeedbackEmails([{email:user.email,name:user.name}],preview);
   const first=res.results?.[0];
   if(!res.ok){
    setQuickEmailStatus({email:user.email,message:res.error||'Could not send email.'});
    return;
   }
   setQuickEmailStatus({
    email:user.email,
    message:first?.sent?`Feedback email sent to ${user.name} (${user.email})!`:`Feedback invitation saved in Supabase for ${user.name}.`,
    url:first?.feedbackUrl,
   });
  }catch{
   setQuickEmailStatus({email:user.email,message:'Could not send feedback email.'});
  }
 },[preview]);
 const refresh=useCallback(async()=>{if(preview){setRows(previewUsers());setActivity({onlineVisitors:18,onlineAccounts:4});setUpdated(new Date().toISOString());return;}setBusy(true);try{const result=await platformRequest('users');if(result.status===401){setAdmin(null);setRows([]);return;}if(!result.ok)throw Error(result.error||'Unable to load users.');if(result.scope==='supabase'||result.scope==='localhost')setScope(result.scope);setActivity(result.activity||{onlineVisitors:0,onlineAccounts:0});const server:AdminUser[]=result.users;const known=new Set(server.map(user=>user.email.toLowerCase()));setRows([...server,...localAdminProfiles().filter(user=>!known.has(user.email.toLowerCase()))]);setUpdated(new Date().toISOString());setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load users.');}finally{setBusy(false);}},[preview]);
 useEffect(()=>{if(preview){void refresh();return;}let cancelled=false;platformRequest('session').then(result=>{if(!cancelled&&result.ok){setAdmin(result.admin.email);void refresh();}}).catch(()=>{if(!cancelled)setError('Administrator service unavailable. Please check the local server.');}).finally(()=>{if(!cancelled)setChecking(false);});return()=>{cancelled=true;};},[refresh]);
 useEffect(()=>{if(!admin)return;const timer=setInterval(()=>void refresh(),30000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus);};},[admin,refresh]);
 useEffect(()=>{const previous=document.title;document.title='Administrator · Chart Replay';return()=>{document.title=previous;};},[]);
 const login=async(event:FormEvent)=>{event.preventDefault();if(adminLockSecondsLeft>0)return;setBusy(true);setError('');try{const result=await platformRequest('admin-login',{email,password});if(result.status===429||result.lockedOut){const until=typeof result.lockedUntil==='number'&&result.lockedUntil>Date.now()?result.lockedUntil:Date.now()+(Number(result.retryAfterSeconds)||30)*1000;setAdminLockoutUntil(until);setAdminNowMs(Date.now());setError(result.error||'Too many failed login attempts. Locked out for 30 seconds.');return;}if(!result.ok)throw Error(result.error||'Unable to sign in.');setAdminLockoutUntil(0);setAdmin(result.admin.email);setPassword('');await refresh();}catch(reason){setError(reason instanceof Error?reason.message:'Unable to sign in.');}finally{setBusy(false);}};
 const logout=async()=>{if(preview){onBack();return;}setBusy(true);try{const result=await platformRequest('admin-logout',{});if(!result.ok)throw Error('Unable to sign out. Please try again.');setAdmin(null);setRows([]);setPassword('');}catch(reason){setError(String(reason));}finally{setBusy(false);}};
 const scrollRef=useRef<HTMLElement>(null);
 useEffect(()=>{scrollRef.current?.scrollTo({top:0});},[tab]);
 const [page,setPage]=useState(1);
 useEffect(()=>setPage(1),[query,filter]);
 const now=Date.now(),week=now-7*86400000;
 const stats=useMemo(()=>({total:rows.length,server:rows.filter(row=>row.source==='server').length,plans:rows.filter(row=>row.hasTradingPlan).length,trades:rows.reduce((sum,row)=>sum+(row.tradeCount||0),0),sessions:rows.reduce((sum,row)=>sum+(row.sessionCount||0),0),logins:rows.reduce((sum,row)=>sum+(row.loginCount||0),0),newWeek:rows.filter(row=>Date.parse(row.joinedAt)>=week).length,active:rows.filter(row=>row.lastLoginAt&&Date.parse(row.lastLoginAt)>=week).length}),[rows,week]);
 const days=Array.from({length:7},(_,index)=>{const date=new Date(now-(6-index)*86400000);const key=localDay(date.toISOString());return {key,label:new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',weekday:'short'}).format(date),count:rows.filter(row=>localDay(row.joinedAt)===key).length};});
 const shown=rows.filter(row=>(!query.trim()||`${row.name} ${row.email}`.toLowerCase().includes(query.trim().toLowerCase()))&&(filter==='all'||filter==='server'&&row.source==='server'||filter==='browser'&&row.source==='browser'||filter==='active'&&row.lastLoginAt&&Date.parse(row.lastLoginAt)>=week)).sort((a,b)=>Date.parse(b.joinedAt)-Date.parse(a.joinedAt));
 const pageResult=pageOf(shown,page);
 const active=rows.filter(row=>(row.loginCount||0)>0).sort((a,b)=>(b.loginCount||0)-(a.loginCount||0)).slice(0,4);
 const card='rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01]';
 if(checking)return <main className="grid h-screen place-items-center bg-[#090f19] text-slate-400 text-sm">Checking administrator access…</main>;
 if(!admin)return <main className="h-[100dvh] overflow-y-auto bg-[#080f19] text-slate-200 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_55%)]"><div className="max-w-5xl mx-auto px-5 py-7"><div className="flex items-center justify-between"><ChartReplayLogo size={36}/><button onClick={onBack} className="flex gap-2 items-center text-xs text-slate-400"><ArrowLeft size={14}/>Back to website</button></div><section className={`${card} max-w-md mx-auto mt-16 p-7 sm:p-9 shadow-2xl`}><div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><ShieldCheck size={24}/></div><p className="text-[10px] tracking-[0.2em] uppercase text-emerald-300">Chart Replay administration</p><h1 className="text-3xl font-semibold tracking-tight mt-3">Welcome back.</h1><p className="text-sm text-slate-400 mt-3 leading-6">Sign in to review registrations, sponsorships, and platform activity.</p><form onSubmit={login} className="mt-7 space-y-4"><div><label htmlFor="admin-email" className="block text-xs text-slate-400 mb-2">Administrator email</label><input id="admin-email" autoComplete="username" type="email" required value={email} onChange={event=>setEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-300/50"/></div><div><label htmlFor="admin-password" className="block text-xs text-slate-400 mb-2">Password</label><div className="relative"><input id="admin-password" autoComplete="current-password" type={showPassword?'text':'password'} required value={password} onChange={event=>setPassword(event.target.value)} maxLength={256} className="w-full rounded-xl border border-white/10 bg-black/20 pl-4 pr-11 py-3 text-sm outline-none focus:border-emerald-300/50"/><button type="button" onClick={()=>setShowPassword(prev=>!prev)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} title={showPassword?'Hide password':'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>{adminLockSecondsLeft>0&&<p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2.5 text-xs text-amber-200 leading-5">Too many failed login attempts (3/3). Locked out for <strong className="font-mono text-white">{adminLockSecondsLeft}s</strong> — please wait before trying again.</p>}{error&&adminLockSecondsLeft===0&&<p role="alert" className="text-xs text-rose-300 leading-5">{error}</p>}<button disabled={busy||adminLockSecondsLeft>0} className="w-full flex justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 p-3 text-sm font-bold text-slate-950 disabled:opacity-50"><KeyRound size={16}/>{busy?'Signing in…':adminLockSecondsLeft>0?`Locked — Wait ${adminLockSecondsLeft}s`:'Sign in to administration'}</button></form><p className="mt-5 text-[11px] text-slate-500 leading-5">Separate administrator access. User passwords are never displayed.</p></section></div></main>;
 return <main ref={scrollRef} className="h-[100dvh] overflow-y-auto bg-[#080f19] text-slate-200 bg-[radial-gradient(ellipse_at_50%_0%,rgba(8,145,178,0.16),transparent_45%)]"><div className="flex min-h-full"><aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#0a121d]/80 px-5 py-7"><ChartReplayLogo size={36}/><p className="mt-6 mb-5 text-[10px] uppercase tracking-[0.2em] text-slate-600">Administrator workspace</p>{([['overview','Overview',ShieldCheck],['newsletter','Email Newsletter',Newspaper],['feedback','Feedback & Emails',MessageSquareHeart],['sponsorship','Sponsorship',Handshake],['analytics','Signup analytics',CalendarDays],['users','Registered users',Users],['waitlist','Waiting list',UserPlus]] as const).map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm mb-2 ${tab===id?'bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300':'text-slate-500 hover:bg-white/5'}`}><Icon size={18}/>{label}</button>)}<div className="mt-auto pt-8"><p className="text-[11px] text-slate-500 break-all">{admin}</p><p className="mt-2 text-[10px] text-emerald-400">{preview?'Sample data · Preview':scope==='supabase'?'Administrator · Connected to Supabase':'Administrator · Localhost'}</p><button onClick={onBack} className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ArrowUpRight size={14}/>Open platform</button></div></aside>
 <div className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-emerald-400">Chart Replay · Administration</p><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">A clearer view of your community.</h1><p className="mt-2 text-sm text-slate-500">Registrations, user account inspection, personalized trader motivation newsletter, feedback emails, and sponsorships.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>setTab('newsletter')} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${tab==='newsletter'?'border-emerald-400/40 bg-emerald-400/15 text-emerald-200':'border-white/10 text-slate-300 hover:bg-white/5'}`}><Newspaper size={14}/>Email Newsletter</button><button onClick={()=>setTab('feedback')} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${tab==='feedback'?'border-emerald-400/40 bg-emerald-400/15 text-emerald-200':'border-white/10 text-slate-300 hover:bg-white/5'}`}><MessageSquareHeart size={14}/>Feedback &amp; Emails</button><button onClick={()=>setTab('sponsorship')} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${tab==='sponsorship'?'border-emerald-400/40 bg-emerald-400/15 text-emerald-200':'border-white/10 text-slate-300 hover:bg-white/5'}`}><Handshake size={14}/>Sponsorship</button><button disabled={busy} onClick={()=>void refresh()} aria-label="Refresh users" className="rounded-xl border border-white/10 p-3 text-slate-400 hover:bg-white/5"><RefreshCw size={16} className={busy?'animate-spin':''}/></button><button disabled={busy} onClick={()=>void logout()} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300"><LogOut size={14}/>{preview?'Exit preview':'Log out'}</button></div></header>
 <div className="lg:hidden flex flex-wrap gap-2 mt-6">{(['overview','newsletter','feedback','sponsorship','analytics','users','waitlist'] as const).map(id=><button key={id} onClick={()=>setTab(id)} className={`rounded-full px-4 py-2 text-xs ${tab===id?'bg-emerald-400/15 text-emerald-300':'bg-white/5 text-slate-500'}`}>{{overview:'Overview',newsletter:'Email Newsletter',feedback:'Feedback & Emails',sponsorship:'Sponsorship',analytics:'Analytics',users:'Users',waitlist:'Waiting list'}[id]}</button>)}<button onClick={onBack} className="ml-auto text-xs text-slate-500">Website</button></div>
 <div className="mt-6 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-4 py-3 text-xs leading-5 text-slate-400">{preview?<><span className="font-semibold text-cyan-200">Dashboard preview · Sample data.</span> These example users and figures show how the administrator dashboard looks. No real accounts are loaded or changed. <a href="/admin" className="underline text-cyan-200">Open real administrator login</a></>:<><span className="text-cyan-200 font-semibold">{scope==='supabase'?'Supabase cloud directory.':'Localhost directory.'}</span> {scope==='supabase'?'All registrations, sign-ins, login timestamps, platform time tracking, newsletters, sponsorships, and trader feedback ratings are synced with Supabase.':`Activity on this local server only.`} Use &ldquo;Log In As User&rdquo; on any account row to inspect their dashboard, trading plan, and sessions as Administrator.</>}</div>
 {error&&<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
 {quickEmailStatus&&<div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200"><span>{quickEmailStatus.message}{quickEmailStatus.url&&<> · <a href={quickEmailStatus.url} target="_blank" rel="noopener noreferrer" className="underline text-cyan-200">Open Feedback Link</a></>}</span><button type="button" onClick={()=>setQuickEmailStatus(null)} className="text-slate-400 hover:text-white">Dismiss</button></div>}
 {tab==='overview'&&<div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-6">{[[Users,'Online visitors',activity.onlineVisitors,'text-emerald-300','from-emerald-500/15'],[Users,'Accounts online',activity.onlineAccounts,'text-cyan-300','from-cyan-500/15'],[CalendarDays,'Replay sessions',stats.sessions,'text-violet-300','from-violet-500/15'],[Users,'Registered users',stats.total,'text-emerald-300','from-emerald-500/15'],[UserPlus,'New in 7 days',stats.newWeek,'text-cyan-300','from-cyan-500/15'],[LogIn,'Successful logins',stats.logins,'text-indigo-300','from-indigo-500/15'],[Clock3,'Active in 7 days',stats.active,'text-violet-300','from-violet-500/15']].map(([Icon,label,value,tone,gradient])=>{const MetricIcon=Icon as typeof Users;return <section key={String(label)} className={`${card} bg-gradient-to-br ${gradient} p-4 sm:p-5`}><div className={`mb-4 flex items-center justify-between ${tone}`}><MetricIcon size={20}/><span className="text-[9px] uppercase tracking-wider opacity-50">Free platform</span></div><p className="text-[11px] text-slate-500">{String(label)}</p><p className={`mt-1 text-3xl font-semibold ${tone}`}>{String(value)}</p></section>;})}<button type="button" onClick={()=>setTab('newsletter')} className={`${card} bg-gradient-to-br from-emerald-500/15 p-4 sm:p-5 text-left hover:border-emerald-400/40 transition`}><div className="mb-4 flex items-center justify-between text-emerald-300"><Newspaper size={20}/><span className="text-[9px] uppercase tracking-wider opacity-70">Bulk &amp; Open Tracker</span></div><p className="text-[11px] text-slate-400">Step-by-Step Trader Playbooks</p><p className="mt-1 text-lg sm:text-xl font-semibold text-white">Send &amp; Track Opens →</p></button></div>}
 {tab==='overview'&&<div className="grid xl:grid-cols-[1.5fr_1fr] gap-4 mt-5"><section className={`${card} p-5 sm:p-6`}><div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Signup activity</h2><span className="text-[10px] text-slate-500">Last 7 days · South Africa</span></div><div className="mt-8 grid grid-cols-7 gap-3 h-36 items-end">{days.map(day=><div key={day.key} className="flex h-full flex-col items-center justify-end"><span className="text-xs text-slate-400 mb-2">{day.count}</span><div className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-emerald-500/30 to-cyan-300/80" style={{height:day.count?`${Math.max(8,day.count/Math.max(1,...days.map(item=>item.count))*90)}px`:'2px'}}/><span className="mt-3 text-[10px] text-slate-600">{day.label}</span></div>)}</div></section><section className={`${card} p-5 sm:p-6`}><h2 className="font-semibold text-sm">Returning to practise</h2><p className="mt-1 text-[11px] text-slate-600">Most recorded sign-ins</p><div className="mt-5 space-y-4">{active.length?active.map(user=><div key={user.id} className="flex items-center justify-between gap-3"><div className="flex gap-3 items-center min-w-0"><div className="h-8 w-8 shrink-0 rounded-xl grid place-items-center bg-emerald-400/10 text-emerald-300 text-xs">{user.name[0]?.toUpperCase()}</div><span className="truncate text-xs text-slate-400">{user.name}</span></div><span className="text-xs font-semibold text-slate-200">{user.loginCount}</span></div>):<p className="text-xs text-slate-500 leading-6">Successful sign-ins will appear here as people start using the platform.</p>}</div></section></div>}
 {tab==='newsletter'&&<AdminNewsletter users={rows} preview={preview}/>}
 {tab==='feedback'&&<AdminFeedback users={rows} preview={preview} onImpersonateUser={user=>void handleImpersonate(user)}/>}
 {tab==='sponsorship'&&<AdminSponsorship preview={preview} scope={scope}/>}
 {tab==='analytics'&&<AdminAnalytics users={rows}/>}
 {tab==='waitlist'&&<AdminWaitlist preview={preview}/>}
 {(tab==='overview'||tab==='users')&&<section className={`${card} mt-5 overflow-hidden`}><div className="flex flex-wrap justify-between items-center gap-4 p-5 sm:p-6 border-b border-white/5"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Registered users <span className="text-slate-500 text-xs font-normal ml-1">({shown.length})</span></h2><span className="rounded-full bg-cyan-400/10 border border-cyan-400/25 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">Admin-only login timestamps &amp; platform duration</span></div><p className="mt-1 text-[11px] text-slate-500">{stats.server} server accounts · {stats.plans} trading plans created · {stats.trades} trades recorded</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2"><Search size={14} className="text-slate-500"/><input aria-label="Search users by name or email" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name or email…" className="w-40 sm:w-48 bg-transparent text-xs outline-none placeholder:text-slate-600"/></label><select aria-label="Filter users" value={filter} onChange={event=>setFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#111b29] px-3 py-2 text-xs text-slate-400"><option value="all">All users</option><option value="server">Server accounts</option><option value="browser">Browser-only</option><option value="active">Active in 7 days</option></select></div></div>
 <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-white/[0.02]"><tr><th className="px-4 py-3.5 font-medium">Name &amp; email</th><th className="px-3.5 py-3.5 font-medium">Signed up</th><th className="px-3.5 py-3.5 font-medium">Trading plan</th><th className="px-3.5 py-3.5 font-medium">Login timestamp</th><th className="px-3.5 py-3.5 font-medium">Time on platform</th><th className="px-3.5 py-3.5 font-medium">Sessions &amp; trades</th><th className="px-3.5 py-3.5 font-medium">Account</th><th className="sticky right-0 z-10 bg-[#0b1320]/95 backdrop-blur-md border-l border-white/10 px-4 py-3.5 font-semibold text-cyan-300 shadow-[-8px_0_16px_rgba(0,0,0,0.4)]">Admin actions</th></tr></thead><tbody>{pageResult.rows.map(user=>{const timing=computeUserPlatformTiming(user);return <tr key={user.source+user.id} className="border-t border-white/5 hover:bg-white/[0.025] group"><td className="px-4 py-3.5"><div className="flex items-center gap-2"><p className="font-semibold text-slate-200">{user.name}</p>{timing.isOnline&&<span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">● Online</span>}</div><p className="mt-0.5 text-slate-400 font-mono text-[11px]">{user.email}</p></td><td className="px-3.5 py-3.5 text-slate-400 whitespace-nowrap"><p>{dateLabel(user.joinedAt)}</p><p className="mt-0.5 text-[10px] text-slate-500">Member for {formatPlatformDurationLabel(timing.memberSec)}</p></td><td className="px-3.5 py-3.5">{user.hasTradingPlan?<div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300"><Check size={11}/>Created</span>{user.tradingPlanName&&<p className="mt-1 text-[11px] text-slate-300 truncate max-w-[165px]" title={user.tradingPlanName}>{user.tradingPlanName}</p>}</div>:<span className="text-slate-600">No plan yet</span>}</td><td className="px-3.5 py-3.5 whitespace-nowrap"><p className="font-medium text-slate-200">{dateLabel(user.lastLoginAt,true)}</p><p className="mt-0.5 text-[10px] text-slate-500">{user.loginCount===null?'—':`${user.loginCount} ${user.loginCount===1?'login':'logins'}`}{user.lastSeenAt?` · Seen ${dateLabel(user.lastSeenAt,true)}`:''}</p></td><td className="px-3.5 py-3.5 whitespace-nowrap"><div className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/25 px-2.5 py-1 text-[11px] font-mono font-bold text-cyan-200"><Clock3 size={12} className="text-cyan-300"/>{formatPlatformDurationLabel(timing.totalActiveSec)} on platform</div><p className="mt-1 text-[10px] text-slate-500">Last session: <span className="text-slate-300 font-mono">{formatPlatformDurationLabel(timing.sessionSec)}</span></p></td><td className="px-3.5 py-3.5 font-mono text-slate-200 whitespace-nowrap"><div><span>{user.sessionCount??0} {(user.sessionCount??0)===1?'session':'sessions'}</span><p className={`mt-0.5 text-[10px] font-sans ${(user.tradeCount||0)>0?'text-emerald-300':'text-slate-500'}`}>{user.tradeCount||0} {(user.tradeCount||0)===1?'trade':'trades'}</p></div></td><td className="px-3.5 py-3.5 whitespace-nowrap"><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] ${user.source==='server'?'bg-emerald-400/10 text-emerald-300':'bg-amber-300/10 text-amber-200'}`}>{user.source==='server'?'Free · Server':'Free · Browser only'}</span></td><td className="sticky right-0 z-10 bg-[#0b1320]/95 group-hover:bg-[#0f192a] backdrop-blur-md border-l border-white/10 px-4 py-3.5 whitespace-nowrap shadow-[-8px_0_16px_rgba(0,0,0,0.4)]"><div className="flex items-center gap-1.5"><button type="button" disabled={impersonatingId===user.id} onClick={()=>void handleImpersonate(user)} title="Log into this user's dashboard as Administrator to inspect their setup and sessions" className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/45 bg-cyan-400/20 px-3 py-1.5 text-[11px] font-bold text-cyan-100 hover:bg-cyan-400/30 disabled:opacity-50 transition shadow-sm"><LogIn size={13}/>{impersonatingId===user.id?'Opening…':'Log In As User'}</button><button type="button" onClick={()=>void handleQuickSendFeedbackEmail(user)} title="Send first-trade feedback email to this user" className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/20 transition"><Mail size={12}/>Feedback</button></div></td></tr>;})}</tbody></table>{shown.length===0&&<div className="p-12 text-center"><Users className="mx-auto text-slate-700 mb-4" size={28}/><p className="text-sm text-slate-400">{query?'No matching users.':'Your community starts here.'}</p><p className="mt-2 text-xs text-slate-600">{query?'Try another name or email.':'New signups will appear after they register on this local server.'}</p></div>}</div>
 <AdminPagination {...pageResult} onPage={setPage}/></section>}<footer className="flex flex-wrap items-center justify-between gap-3 py-6 text-[10px] text-slate-600"><p>Login counts start when tracking is enabled. Refreshing a page does not count as a login.</p><p>{updated?`Updated ${dateLabel(updated,true)} SAST`:'Waiting for records'}</p></footer>
 </div></div></main>;
}
