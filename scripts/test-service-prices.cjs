const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{PGlite}=require('@electric-sql/pglite'),{NextRequest}=require('next/server');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:require(n),m,m.exports);return m.exports}
(async()=>{
 const db=new PGlite();await db.exec(`CREATE TABLE "Business" (id TEXT PRIMARY KEY,"billingAmount" INTEGER);CREATE TABLE "Service" ("price" INTEGER);INSERT INTO "Business" VALUES ('existing',5500);INSERT INTO "Service" VALUES (160);`);
 const sql=fs.readFileSync(path.join(__dirname,'../prisma/migrations/20261111190000_optional_service_prices/migration.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 assert.equal((await db.query('SELECT * FROM "Business"')).rows[0].showServicePrices,false);assert.equal((await db.query('SELECT * FROM "Business"')).rows[0].billingAmount,5500);assert.equal((await db.query('SELECT * FROM "Service"')).rows[0].price,160);await db.close();
 let session={businessId:'owned'},updates=[];const route=load('app/api/business/service-prices/route.ts',{'@/lib/business-auth':{auth:async()=>session},'@/lib/prisma':{prisma:{business:{update:async q=>updates.push(q)}}}});
 const req=(body,origin='https://bookeasy.ro')=>new NextRequest('https://bookeasy.ro/api/business/service-prices',{method:'PATCH',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await route.PATCH(req({showServicePrices:true}))).status,200);assert.deepEqual(updates[0],{where:{id:'owned'},data:{showServicePrices:true}});
 assert.equal((await route.PATCH(req({showServicePrices:false,businessId:'another'}))).status,400);
 assert.equal((await route.PATCH(req({showServicePrices:'false'}))).status,400);
 assert.equal((await route.PATCH(req({showServicePrices:false},'https://other.example'))).status,403);
 session=null;assert.equal((await route.PATCH(req({showServicePrices:false}))).status,401);assert.equal(updates.length,1);
 const div=({children,...props})=>React.createElement('div',props,children);
 const component=load('app/dashboard/servicii/services-manager.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/fetch-with-timeout':{fetchWithTimeout:()=>{throw Error('No network during render')}},'@/components/ui/card':{Card:div,CardInteractive:div},'@/components/ui/input':{Input:p=>React.createElement('input',p)},'@/components/ui/button':{Button:({variant,children,...p})=>React.createElement('button',p,children)},'@/lib/business-categories':{isAppointmentCategory:c=>c!=='EVENT_VENUE',offerLabel:()=>({heading:'Servicii',plural:'servicii',singular:'serviciu'})}}).default;
 for(const category of ['SALON','EVENT_VENUE'])for(const enabled of [false,true]){const html=renderToStaticMarkup(React.createElement(component,{category,showServicePrices:enabled,services:[{id:'s',name:'Serviciu test',price:160,durationMin:60,active:true}],resources:[{id:'r',name:'Sala test',basePrice:160,capacity:20}]}));assert.equal(html.includes('160 lei'),enabled);assert.ok(html.includes('Afișează prețurile serviciilor'));}
 console.log('PASS: default off, idempotent migration preserves service prices and B2B billing, tenant isolation/auth/origin validation, salon and venue prices shown only when enabled. No live data changed.');
})().catch(e=>{console.error(e);process.exitCode=1});
