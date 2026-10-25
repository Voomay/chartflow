import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {isSupabaseConfigured,readSupabaseWaitlist} from './supabaseStore.mjs';
const directory=()=>process.env.PLATFORM_DATA_DIR||path.join(homedir(),'.chart-replay');
export const isLocalWaitlistHost=host=>/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host||'')&&!process.env.VERCEL;
export async function localWaitlistReady(host){if(!isLocalWaitlistHost(host))return false;try{const config=JSON.parse(await readFile(path.join(directory(),'admin.json'),'utf8'));return Boolean(config.email&&config.passwordHash&&config.sessionSecret);}catch{return false;}}
export function createLocalWaitlistStore(root=directory()){
 let pending=Promise.resolve();
 const read=async()=>{try{const data=JSON.parse(await readFile(path.join(root,'waitlist.json'),'utf8'));if(!Array.isArray(data))throw Error('Invalid waiting list');return data;}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const save=entry=>{const work=pending.then(async()=>{const rows=await read();if(rows.some(row=>row.email===entry.email))return;rows.push(entry);await mkdir(root,{recursive:true,mode:0o700});const temporary=path.join(root,`waitlist-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(rows,null,2),{mode:0o600});await rename(temporary,path.join(root,'waitlist.json'));});pending=work.catch(()=>{});return work;};
 return {read,save};
}
const localStore=createLocalWaitlistStore();
export const saveLocalWaitlist=entry=>localStore.save(entry);
export async function readAdminWaitlist({env=process.env,request=fetch}={}){
 let rows,source;
 if(env.WAITLIST_ENABLED==='true'&&env.WAITLIST_REDIS_REST_URL&&env.WAITLIST_REDIS_REST_TOKEN){
  const url=new URL(env.WAITLIST_REDIS_REST_URL);if(url.protocol!=='https:')throw Error('Invalid database');
  const response=await request(url,{method:'POST',headers:{Authorization:`Bearer ${env.WAITLIST_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(['HVALS','chart-replay:waitlist:v1']),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Database unavailable');const result=await response.json();if(result.error||!Array.isArray(result.result))throw Error('Invalid response');rows=result.result.map(item=>typeof item==='string'?JSON.parse(item):item);source='redis';
 }else if(isSupabaseConfigured(env)){
  try{rows=await readSupabaseWaitlist({env,request});source='supabase';}catch(error){if(error.code==='PGRST205'||error.status===404){rows=await localStore.read();source='local';}else throw error;}
 }else{rows=await localStore.read();source='local';}
 return {entries:rows.filter(row=>row&&typeof row.email==='string'&&Number.isFinite(Date.parse(row.joinedAt))).map(row=>({name:typeof row.name==='string'?row.name:'',email:row.email,joinedAt:row.joinedAt,consent:row.consent===true,consentVersion:row.consentVersion||null})),source};
}
