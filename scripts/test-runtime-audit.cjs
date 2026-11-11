const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),crypto=require('node:crypto');
const {NextRequest}=require('next/server');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);return m.exports}
async function testCancellation(){
 const original=global.fetch,fetchWithTimeout=load('lib/fetch-with-timeout.ts').fetchWithTimeout;
 try{
  global.fetch=async(_,options)=>new Promise((resolve,reject)=>{if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})});
  const caller=new AbortController(),pending=fetchWithTimeout('https://example.invalid',{signal:caller.signal},1000);caller.abort();await assert.rejects(pending,{name:'AbortError'});
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(fetchWithTimeout('https://example.invalid',{signal:cancelled.signal},1000),{name:'AbortError'});
  await assert.rejects(fetchWithTimeout('https://example.invalid',{},5),{name:'AbortError'});
  global.fetch=async()=>new Response('ok');assert.equal(await(await fetchWithTimeout('https://example.invalid',{},1000)).text(),'ok');
 }finally{global.fetch=original}
 console.log('PASS requests: caller cancellation, pre-cancelled requests, timeout and successful response. No network used.');
}
async function testMeta(){
 const previous={meta:process.env.META_APP_SECRET,instagram:process.env.INSTAGRAM_APP_SECRET,verify:process.env.META_VERIFY_TOKEN};
 process.env.META_APP_SECRET='local-meta-fixture';process.env.INSTAGRAM_APP_SECRET='local-instagram-fixture';process.env.META_VERIFY_TOKEN='local-verification-fixture';
 const claims=new Map(),incoming=[];let fail=false;
 const prisma={channel:{findUnique:async({where})=>{const {type,externalId}=where.type_externalId;if(externalId==='unknown')return null;return {id:'channel',businessId:'business',type,status:'ACTIVE',authProvider:type==='INSTAGRAM'?'instagram':'meta'}}},processedWebhookMessage:{
  create:async({data})=>{if(claims.has(data.id))throw Object.assign(Error('duplicate'),{code:'P2002'});claims.set(data.id,{...data})},
  updateMany:async({where,data})=>{const item=claims.get(where.id);if(!item||where.status&&item.status!==where.status||where.claimToken&&item.claimToken!==where.claimToken||where.leaseUntil&&!(item.leaseUntil<where.leaseUntil.lt))return {count:0};Object.assign(item,data);return {count:1}},
  findUnique:async({where})=>claims.get(where.id),deleteMany:async({where})=>({count:claims.delete(where.id)?1:0}),
 }};
 const route=load('app/api/webhooks/meta/route.ts',{'@/lib/prisma':{prisma},'@/lib/bot-engine':{processIncomingMessage:async data=>{if(fail)throw Error('retry');incoming.push(data)}}});
 const body=(id,type='page',extra={})=>({object:type,entry:[{id:'page-id',messaging:[{sender:{id:'sender'},message:{mid:id,text:'Salut',...extra}}]}]});
 function req(value,provider='meta',valid=true){const text=JSON.stringify(value),key=provider==='meta'?process.env.META_APP_SECRET:process.env.INSTAGRAM_APP_SECRET;return new NextRequest('https://bookeasy.ro/api/webhooks/meta',{method:'POST',headers:{'x-hub-signature-256':valid?'sha256='+crypto.createHmac('sha256',key).update(text).digest('hex'):'sha256=invalid'},body:text})}
 try{
  assert.equal((await route.GET(new NextRequest('https://bookeasy.ro/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=local-verification-fixture&hub.challenge=test'))).status,200);
  assert.equal((await route.POST(req(body('bad'),'meta',false))).status,401);assert.equal(incoming.length,0);
  assert.equal((await route.POST(req(body('fb')))).status,200);await route.POST(req(body('fb')));assert.equal(incoming.length,1);assert.equal(incoming[0].channel,'FACEBOOK');
  await route.POST(req(body('ig','instagram'),'instagram'));assert.equal(incoming.at(-1).channel,'INSTAGRAM');
  const count=incoming.length;await route.POST(req(body('echo','page',{is_echo:true})));await route.POST(req(body('wrong-provider','instagram'),'meta'));assert.equal(incoming.length,count);
  await route.POST(req({object:'page',entry:[{id:'page-id',messaging:[{sender:{id:'sender'},postback:{mid:'button',payload:'BOOK_NOW'}}]}]}));assert.equal(incoming.at(-1).text,'BOOK_NOW');
  fail=true;await assert.rejects(route.POST(req(body('retry'))));assert(!claims.has('retry'));fail=false;await route.POST(req(body('retry')));assert.equal(claims.get('retry').status,'DONE');
  await route.POST(req({object:'whatsapp_business_account',entry:[]}));assert.equal(incoming.at(-1).channel,'FACEBOOK');
 }finally{for(const [name,value] of Object.entries({META_APP_SECRET:previous.meta,INSTAGRAM_APP_SECRET:previous.instagram,META_VERIFY_TOKEN:previous.verify})){if(value===undefined)delete process.env[name];else process.env[name]=value}}
 console.log('PASS Meta: verification, signatures, Facebook/Instagram routing, duplicates, echo, provider isolation, buttons and retries. No messages sent.');
}
(async()=>{await testCancellation();await testMeta()})().catch(e=>{console.error(e);process.exitCode=1});
