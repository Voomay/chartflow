import {getRegisteredUsers,setActiveLoggedInUser,purgeBrowserSensitiveStorage,RegisteredUser} from './storageAndAnalytics';
export interface AdminUser {id:string;name:string;email:string;joinedAt:string;loginCount:number|null;lastLoginAt:string|null;lastSeenAt?:string|null;sessionCount?:number|null;source:'server'|'browser';}
export function localAdminProfiles():AdminUser[]{return getRegisteredUsers().filter(user=>user.id!=='user-demo-trader'&&user.authSource!=='server').map(user=>({id:user.id,name:user.name,email:user.email,joinedAt:user.joinedAt,loginCount:user.loginCount??null,lastLoginAt:user.lastLoginAt??null,source:'browser'}));}
export async function platformRequest(action:string,body?:object){
 const response=await fetch(`/api/platform?action=${encodeURIComponent(action)}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',signal:AbortSignal.timeout(15000)}:{credentials:'same-origin',signal:AbortSignal.timeout(15000)});
 const data=await response.json();return {ok:response.ok,status:response.status,...data};
}
export async function serverAccountRequest(action:'register'|'login',body:{name?:string;email:string;password:string}){
 const status=await platformRequest('status');if(!status.ok)throw Error('Account service unavailable. Please try again.');
 if(!status.enabled)return {available:false,ok:false,user:undefined as RegisteredUser|undefined,error:undefined as string|undefined};
 const result=await platformRequest(action,body);
 if(!result.ok||!result.user)return {available:true,ok:false,user:undefined as RegisteredUser|undefined,error:result.error as string};
 const user:RegisteredUser={...result.user,authSource:'server',passwordHash:''};
 // Keep active profile in runtime memory only; never persist trader login details to localStorage.
 purgeBrowserSensitiveStorage();
 setActiveLoggedInUser(user);return {available:true,ok:true,user,error:undefined};
}
