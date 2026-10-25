import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWaitlistHandler} from '../api/waitlist.js';
const env={WAITLIST_ENABLED:'true',WAITLIST_REDIS_REST_URL:'https://database.example.invalid',WAITLIST_REDIS_REST_TOKEN:'test-only'};
async function run({settings=env,body={name:'Test',email:'PREVIEW@example.invalid',consent:true,website:''},method='POST',origin='https://example.invalid',result=1,request}={}){
  let command;
  const handler=createWaitlistHandler({env:settings,request:request|| (async(url,options)=>{command=JSON.parse(options.body);return {ok:true,json:async()=>({result})};})});
  const res={headers:{},setHeader(key,value){this.headers[key]=value;},end(value){this.body=JSON.parse(value);}};
  await handler({method,body,headers:{host:'example.invalid',origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}},res);
  return {...res,command};
}
test('disabled status exposes no credentials',async()=>{const res=await run({settings:{},method:'GET'});assert.deepEqual(res.body,{enabled:false});});
test('disabled signups fail without database access',async()=>{assert.equal((await run({settings:{}})).statusCode,503);});
test('writes normalised email and consent with atomic deduplication',async()=>{const res=await run();assert.equal(res.statusCode,200);assert.equal(res.command[0],'EVAL');const entry=JSON.parse(res.command.at(-1));assert.equal(entry.email,'preview@example.invalid');assert.equal(entry.consentVersion,'launch-updates-v1');assert.equal(res.command.at(-2).length,64);});
test('requires consent',async()=>{assert.equal((await run({body:{email:'preview@example.invalid',consent:false}})).statusCode,400);});
test('rejects invalid email',async()=>{assert.equal((await run({body:{email:'not-an-email',consent:true}})).statusCode,400);});
test('rejects a honeypot submission',async()=>{assert.equal((await run({body:{website:'spam',email:'preview@example.invalid',consent:true}})).statusCode,400);});
test('rejects cross-origin browser requests',async()=>{assert.equal((await run({origin:'https://elsewhere.invalid'})).statusCode,403);});
test('rejects oversized parsed bodies',async()=>{assert.equal((await run({body:{name:'x'.repeat(5000)}})).statusCode,413);});
test('returns rate-limit status from database',async()=>{assert.equal((await run({result:-1})).statusCode,429);});
test('never claims success on database failure or leaks upstream details',async()=>{const res=await run({request:async()=>{throw Error('secret-token');}});assert.equal(res.statusCode,503);assert.ok(!JSON.stringify(res.body).includes('secret-token'));});
test('does not accept unconfirmed database response',async()=>{assert.equal((await run({result:null})).statusCode,503);});
