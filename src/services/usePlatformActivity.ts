import {useEffect} from 'react';
import {platformRequest} from './platformAccounts';
import {getActiveLoggedInUser,loadUserSessions} from './storageAndAnalytics';

const sessionVisitorId=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`;

export function usePlatformActivity(email:string|undefined,sessionKey:string,disabled:boolean){
 useEffect(()=>{
  if(disabled)return;
  const visitorId=sessionVisitorId;
  let stopped=false;
  const report=async()=>{
   if(stopped||document.visibilityState==='hidden')return;
   const user=getActiveLoggedInUser();
   const account=user?.authSource==='server'&&user.email===email?user:null;
   try{await platformRequest('activity',{visitorId,accountId:account?.id||null,sessionIds:account?loadUserSessions(account.email).map(s=>s.id).filter(id=>!/^session-(normal|prop)-/.test(id)).slice(0,1000):[]});}catch{/* Activity never blocks the simulator. */}
  };
  const initial=setTimeout(()=>void report(),500);
  const timer=setInterval(()=>void report(),30000);
  const visible=()=>void report();document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;clearTimeout(initial);clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[email,sessionKey,disabled]);
}
