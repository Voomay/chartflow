import {useEffect} from 'react';
import {platformRequest} from './platformAccounts';
import {getActiveLoggedInUser,loadUserSessions} from './storageAndAnalytics';

export function usePlatformActivity(email:string|undefined,sessionKey:string,disabled:boolean){
 useEffect(()=>{
  if(disabled)return;
  let visitorId:string;
  try{visitorId=localStorage.getItem('chart_replay_visitor_id')||crypto.randomUUID();localStorage.setItem('chart_replay_visitor_id',visitorId);}catch{visitorId=crypto.randomUUID();}
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
