import {getRegisteredUsers,setActiveLoggedInUser,purgeBrowserSensitiveStorage,RegisteredUser} from './storageAndAnalytics';
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
