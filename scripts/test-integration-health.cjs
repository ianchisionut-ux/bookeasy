const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {NextRequest}=require('next/server');
const previousFetch=global.fetch,previousKey=process.env.RESEND_API_KEY;
let session={isSuperAdmin:true},fixture={status:401,body:{name:'restricted_api_key',message:'This API key is restricted to only send emails'}};
const mocks={
 '@/lib/auth':{auth:async()=>session},'@/lib/prisma':{prisma:{googleCalendarConnection:{findMany:async()=>[]},channel:{findMany:async()=>[]}}},
 '@/lib/crypto':{decrypt:()=>{throw Error('No credentials should be read for an unconnected business')}},
 '@/lib/google-wallet':{walletConfigured:()=>false},'@/lib/google-business-oauth':{googleBusinessCredentials:()=>null,refreshGoogleBusinessToken:()=>{throw Error('No refresh expected')}},
 '@/lib/sms-routing':{isPlatformSmsReady:async()=>false},
};
const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/api/superadmin/integration-health/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(name=>name in mocks?mocks[name]:require(name),m,m.exports);
(async()=>{let requests=0;process.env.RESEND_API_KEY='fixture-key-not-real';global.fetch=async(url,init)=>{requests++;assert.equal(String(url),'https://api.resend.com/domains');assert.ok(!init.method||init.method==='GET');return new Response(JSON.stringify(fixture.body),{status:fixture.status,headers:{'Content-Type':'application/json'}})};
 const request=()=>new NextRequest('https://bookeasy.ro/api/superadmin/integration-health?businessId=fixture');
 for(const test of [
   {status:401,body:{name:'restricted_api_key'},expected:'sending_key_configured'},
   {status:403,body:{name:'restricted_api_key'},expected:'sending_key_configured'},
   {status:401,body:{name:'validation_error'},expected:'authentication_failed'},
   {status:403,body:{name:'forbidden'},expected:'provider_check_failed'},
   {status:500,body:{name:'internal_error'},expected:'provider_check_failed'},
   {status:200,body:{data:[{name:'bookeasy.ro',status:'verified'}]},expected:'account_access_ok'},
 ]){fixture=test;const response=await m.exports.GET(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.email.status,test.expected);if(test.status===200)assert.equal(body.email.senderDomainStatus,'verified')}
 session=null;assert.equal((await m.exports.GET(request())).status,401);assert.equal(requests,6);
 session={businessId:'owner-business',isSuperAdmin:false};assert.equal((await m.exports.GET(request())).status,403);assert.equal(requests,6);
 console.log('PASS: restricted send-only Resend keys are valid (401/403), actual authentication failures remain failures, domain verification, provider errors, authentication and business isolation. No messages, emails or live provider requests sent.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=previousFetch;if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey});
