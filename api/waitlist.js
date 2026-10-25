import {localWaitlistReady,saveLocalWaitlist} from '../server/waitlistStore.mjs';
import {isSupabaseConfigured,saveSupabaseWaitlist} from '../server/supabaseStore.mjs';
import {createHash} from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
// One atomic operation: rate limit, deduplicate, and record confirmed consent.
const SAVE = `
local attempts = redis.call('INCR', KEYS[1])
if attempts == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
if attempts > 10 then return -1 end
redis.call('HSETNX', KEYS[2], ARGV[1], ARGV[2])
return 1
`;
export function createWaitlistHandler({env = process.env, request = fetch,localReady=localWaitlistReady,localSave=saveLocalWaitlist} = {}) {
  const redisReady = () => env.WAITLIST_ENABLED === 'true' && Boolean(env.WAITLIST_REDIS_REST_URL && env.WAITLIST_REDIS_REST_TOKEN);
  const supabaseReady = () => isSupabaseConfigured(env);
  const ready = () => redisReady() || supabaseReady();
  const localAttempts=new Map();
  return async function handler(req, res) {
    const local=!ready()&&await localReady(req.headers.host);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => {res.statusCode = status;res.end(JSON.stringify(body));};
    if (req.method === 'GET') return send(200, {enabled: ready()||local});
    if (req.method !== 'POST') {res.setHeader('Allow', 'GET, POST');return send(405, {error:'Method not allowed.'});}
    if (!ready()&&!local) return send(503, {error:'Waitlist signups are not open yet. Please check back soon.'});
    try {
      if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return send(403, {error:'Please submit the form from this website.'});
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, {error:'Please use the waitlist form.'});
      if (Number(req.headers['content-length']) > 4096) return send(413, {error:'Request is too large.'});
      let body = req.body;
      if (body === undefined) {
        let raw = '';
        for await (const chunk of req) {raw += chunk;if (Buffer.byteLength(raw) > 4096) return send(413, {error:'Request is too large.'});}
        body = raw;
      }
      if (typeof body === 'string') {if (Buffer.byteLength(body) > 4096) return send(413, {error:'Request is too large.'});try {body = JSON.parse(body);} catch {return send(400,{error:'Invalid form data.'});}}
      if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, {error:'Invalid form data.'});
      if (Buffer.byteLength(JSON.stringify(body)) > 4096) return send(413, {error:'Request is too large.'});
      if (body.website) return send(400, {error:'Please leave the website field empty.'});
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!name || name.length > 80 || /[\x00-\x1f]/.test(name) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, {error:'Please enter a valid email address and a name of 80 characters or fewer.'});
      if (body.consent !== true) return send(400, {error:'Please agree to receive launch and early-access updates.'});
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const record = {email, name, joinedAt:new Date().toISOString(), consent:true, consentVersion:'launch-updates-v1', source:'coming-soon'};
      const checkLocalRateLimit = () => {
        const key=digest(ip),time=Date.now();
        for(const[k,v]of localAttempts)if(v.until<=time)localAttempts.delete(k);
        if(localAttempts.size>=10000&&!localAttempts.has(key))return 'capacity';
        const limit=localAttempts.get(key)||{count:0,until:time+3600000};
        limit.count++;localAttempts.set(key,limit);
        return limit.count>10?'limited':'ok';
      };
      if(local){const rl=checkLocalRateLimit();if(rl==='capacity')return send(429,{error:'Please try again later.'});if(rl==='limited'){res.setHeader('Retry-After','3600');return send(429,{error:'Too many attempts. Please try again in an hour.'});}await localSave(record);return send(200,{ok:true});}
      if(!redisReady() && supabaseReady()){
        const rl=checkLocalRateLimit();
        if(rl==='capacity')return send(429,{error:'Please try again later.'});
        if(rl==='limited'){res.setHeader('Retry-After','3600');return send(429,{error:'Too many attempts. Please try again in an hour.'});}
        try{
          await saveSupabaseWaitlist(record, {env, request});
          return send(200,{ok:true});
        }catch(err){
          if((err.code==='PGRST205'||err.status===404)&&await localReady(req.headers.host)){
            await localSave(record);
            return send(200,{ok:true});
          }
          throw err;
        }
      }
      const database = new URL(env.WAITLIST_REDIS_REST_URL);
      if (database.protocol !== 'https:') throw new Error('Invalid database configuration');
      const response = await request(database, {
        method:'POST', headers:{Authorization:`Bearer ${env.WAITLIST_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},
        body:JSON.stringify(['EVAL',SAVE,'2',`chart-replay:waitlist:rate:${digest(ip)}`, 'chart-replay:waitlist:v1',digest(email),JSON.stringify(record)]),
        signal:AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Database unavailable');
      const result = await response.json();
      if (result.result === -1) {res.setHeader('Retry-After','3600');return send(429,{error:'Too many attempts. Please try again in an hour.'});}
      if (result.error || result.result !== 1) throw new Error('Save not confirmed');
      // Same response for existing and new addresses, avoiding membership disclosure.
      return send(200, {ok:true});
    } catch {
      // Never expose submitted details, database credentials, or upstream errors.
      return send(503, {error:'We could not save your signup right now. Please try again later.'});
    }
  };
}
export default createWaitlistHandler();
