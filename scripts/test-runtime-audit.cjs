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
async function testBusinessMapLocation() {
  let role = 'OWNER'
  const business = { latitude: 47, longitude: 23, mapLocationConfirmed: false, city: 'Zalău', address: '' }
  const prisma = {
    business: {
      findUnique: async () => ({ ...business }),
      update: async ({ data }) => ({ ...Object.assign(business, data) }),
      findMany: async ({ where }) => {
        assert.equal(where.mapLocationConfirmed, true)
        return business.mapLocationConfirmed ? [{ latitude: business.latitude, longitude: business.longitude }] : []
      },
    },
    workingHours: { deleteMany: async () => {}, createMany: async () => {} },
    $transaction: async (operation) => operation(prisma),
  }
  const { PATCH } = load('app/api/business/settings/route.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/business-auth': { auth: async () => ({ businessId: 'business', role }) },
    '@/lib/romanian-cities': { canonicalCity: city => city },
    '@/lib/business-plan-access': { businessHasPlan: async () => true },
  })
  const { GET } = load('app/api/businesses/map/route.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/business-categories': { PUBLIC_CATEGORIES: ['SALON'] },
  })
  const profile = { name: 'Salon de test', city: 'Cluj-Napoca', address: 'Adresă de test', publicListed: true, workingHours: [] }
  const save = changes => PATCH(new NextRequest('https://bookeasy.ro/api/business/settings', {
    method: 'PATCH',
    body: JSON.stringify({ ...profile, ...changes }),
  }))
  const visiblePins = async () => (await (await GET(new NextRequest('https://bookeasy.ro/api/businesses/map'))).json()).businesses

  assert.deepEqual(await visiblePins(), [])
  const textOnly = await save({ latitude: 40, longitude: 20, mapLocationConfirmed: true })
  assert.equal(textOnly.status, 200)
  assert.deepEqual(await textOnly.json(), { success: true, locationChanged: false, location: null, hasUnconfirmedPin: true })
  assert.equal(business.latitude, 47)
  assert.equal(business.longitude, 23)
  assert.deepEqual(await visiblePins(), [])

  const manualLocation = { lat: 46, lng: 24 }
  role = 'STAFF'
  assert.equal((await save({ manualLocation })).status, 403)
  assert.deepEqual(await visiblePins(), [])
  role = 'OWNER'
  assert.equal((await save({ manualLocation: { lat: 100, lng: 24 } })).status, 400)
  const confirmed = await save({ manualLocation })
  assert.equal(confirmed.status, 200)
  assert.deepEqual((await confirmed.json()).location, manualLocation)
  assert.deepEqual(await visiblePins(), [{ latitude: 46, longitude: 24 }])
  assert.equal((await save({ address: 'Text editat' })).status, 200)
  assert.deepEqual(await visiblePins(), [{ latitude: 46, longitude: 24 }])

  const cleared = await save({ manualLocation: null })
  assert.equal(cleared.status, 200)
  assert.deepEqual(await cleared.json(), { success: true, locationChanged: true, location: null, hasUnconfirmedPin: false })
  assert.equal(business.latitude, null)
  assert.equal(business.longitude, null)
  assert.deepEqual(await visiblePins(), [])
  console.log('PASS map pins: legacy hidden, address changes preserve coordinates, admin save publishes, explicit removal hides')
}
async function testSmsApi() {
  const { submitSmsApi } = load('lib/smsapi.ts')
  const { reminderSms, smsUnits } = load('lib/sms-policy.ts')
  const reminder = reminderSms('Salon Démo', '25.11, 14:30', '')
  assert.equal(reminder, 'Salon Demo: programare 25.11, 14:30.')
  assert.ok(smsUnits(reminderSms('Salon '.repeat(30), '25.11, 14:30', '')) <= 160)

  const config = { token: 'test-token', sender: 'BookEasy' }
  const job = { id: 'sms-fixture', recipient: '+40700000000', message: reminder }
  const originalFetch = global.fetch
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.smsapi.ro/sms.do')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      assert.equal(options.body.get('to'), '40700000000')
      assert.equal(options.body.get('message'), reminder)
      assert.equal(options.body.get('max_parts'), '1')
      assert.equal(options.body.get('idx'), job.id)
      assert.equal(options.body.get('check_idx'), '1')
      return Response.json({ count: 1, list: [{ id: 'provider-id', status: 'QUEUE', error: null }] })
    }
    assert.deepEqual(await submitSmsApi(config, job), { status: 'SENT', error: null })
    global.fetch = async () => Response.json({ error: 14, message: 'private provider payload' })
    const rejected = await submitSmsApi(config, job)
    assert.equal(rejected.status, 'FAILED')
    assert.match(rejected.error, /cod 14/)
    assert.doesNotMatch(rejected.error, /private provider payload/)
    global.fetch = async () => Response.json({ error: 53 })
    assert.equal((await submitSmsApi(config, job)).status, 'UNKNOWN')
    global.fetch = async () => { throw Error('network interrupted') }
    assert.equal((await submitSmsApi(config, job)).status, 'UNKNOWN')
  } finally {
    global.fetch = originalFetch
  }
  console.log('PASS SMSAPI: single-segment reminder, protected request, accepted, rejected, duplicate and ambiguous outcomes')
}

async function testSmsApiPreflight() {
  const smsApi = load('lib/smsapi.ts')
  const env = { SMSAPI_TOKEN: process.env.SMSAPI_TOKEN, SMSAPI_SENDER: process.env.SMSAPI_SENDER, BOOKEASY_SMS_PROVIDER: process.env.BOOKEASY_SMS_PROVIDER }
  const originalFetch = global.fetch
  let isSuperAdmin = false
  let calls = 0
  let providerResponse = () => Response.json({ count: 1, list: [{ id: 'dry-run-example' }] })
  const { POST } = load('app/api/superadmin/sms/route.ts', {
    '@/lib/private-json': load('lib/private-json.ts'),
    '@/lib/prisma': { prisma: new Proxy({}, { get: () => assert.fail('Dry-run must not touch the database') }) },
    '@/lib/auth': { auth: async () => ({ isSuperAdmin }) },
    '@/lib/sms-gateway': { normalizeSmsPhone: value => value },
    '@/lib/sms-device-auth': {},
    '@/lib/sms-job-status': {},
    '@/lib/smsapi': smsApi,
  })
  const endpoint = 'https://bookeasy.ro/api/superadmin/sms'
  const request = (origin = 'https://bookeasy.ro', body = { action: 'test-smsapi' }) => new NextRequest(endpoint, {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  try {
    delete process.env.BOOKEASY_SMS_PROVIDER
    delete process.env.SMSAPI_TOKEN
    delete process.env.SMSAPI_SENDER
    global.fetch = async (url, options) => {
      calls++
      assert.equal(url, 'https://api.smsapi.ro/sms.do')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.Authorization, 'Bearer fixture-token')
      assert.equal(options.body.get('to'), '48500000000')
      assert.equal(options.body.get('from'), 'BookEasy')
      assert.equal(options.body.get('message'), 'Salon Demo: programare 25.11, 14:30.')
      assert.equal(options.body.get('test'), '1')
      assert.equal(options.body.get('max_parts'), '1')
      return providerResponse()
    }
    assert.equal((await POST(request())).status, 403)
    isSuperAdmin = true
    assert.equal((await POST(request('https://example.invalid'))).status, 403)
    assert.equal((await POST(request(undefined, { action: 'test-smsapi', to: '40700000000' }))).status, 400)
    const unconfigured = await POST(request())
    assert.equal(unconfigured.status, 409)
    assert.equal((await unconfigured.json()).status, 'unconfigured')
    assert.equal(calls, 0)

    process.env.SMSAPI_TOKEN = 'fixture-token'
    process.env.SMSAPI_SENDER = 'BookEasy'
    const accepted = await POST(request())
    assert.equal(accepted.status, 200)
    assert.equal(accepted.headers.get('Cache-Control'), 'private, no-store')
    assert.deepEqual(await accepted.json(), { status: 'accepted', message: 'SMSAPI a acceptat testul. Nu a fost trimis niciun SMS.' })
    providerResponse = () => Response.json({ error: 14, message: 'secret upstream payload' })
    const rejected = await POST(request())
    assert.equal(rejected.status, 422)
    const rejectedResult = await rejected.json()
    assert.equal(rejectedResult.status, 'rejected')
    assert.match(rejectedResult.message, /cod 14/)
    assert.doesNotMatch(rejectedResult.message, /secret upstream payload/)
    providerResponse = () => new Response('unknown payload')
    const unavailable = await POST(request())
    assert.equal(unavailable.status, 502)
    assert.equal((await unavailable.json()).status, 'unavailable')
    assert.equal(calls, 3)
  } finally {
    global.fetch = originalFetch
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
  console.log('PASS SMSAPI preflight: gated by role and origin, fixed no-send request, works while disabled, no database or raw provider data')
}

async function testSmsEconomy() {
  const smsApi = load('lib/smsapi.ts')
  const savedEnv = { provider: process.env.BOOKEASY_SMS_PROVIDER, limit: process.env.SMSAPI_DAILY_LIMIT, auto: process.env.SMSAPI_AUTO_RECONFIRMATION }
  const now = new Date()
  const attempts = []
  const prisma = {
    $executeRaw: async () => {},
    $transaction: async operation => operation(prisma),
    booking: { findFirst: async () => ({ id: 'booking-a' }) },
    smsJob: {
      findUnique: async ({ where: { businessId_idempotencyKey: key } }) => attempts.find(row => row.businessId === key.businessId && row.idempotencyKey === key.idempotencyKey) ?? null,
      findMany: async ({ where }) => attempts.filter(row => row.businessId === where.businessId && row.bookingId === where.OR[0].bookingId),
      count: async ({ where }) => attempts.filter(row => (!where.businessId || where.businessId === row.businessId)
        && (!where.recipient || where.recipient === row.recipient) && (!where.senderKey || where.senderKey === row.senderKey)).length,
      create: async ({ data }) => {
        const row = { ...data, id: 'test-sms', createdAt: now, status: 'PENDING' }
        attempts.push(row)
        return row
      },
    },
  }
  const smsLimits = load('lib/sms-limits.ts', {
    '@/lib/prisma': { prisma }, '@/lib/sms-job-status': load('lib/sms-job-status.ts'), '@/lib/smsapi': smsApi,
  })
  const { sendScheduledReconfirmations } = load('lib/scheduled-reconfirmation.ts', {
    '@/lib/prisma': { prisma: { booking: { findMany: () => assert.fail('Paid automation must be disabled by default') } } },
    '@/lib/confirmation-request': {}, '@/lib/business-plans': {}, '@/lib/smsapi': smsApi,
  })
  try {
    process.env.BOOKEASY_SMS_PROVIDER = 'smsapi'
    delete process.env.SMSAPI_AUTO_RECONFIRMATION
    delete process.env.SMSAPI_DAILY_LIMIT
    assert.equal(smsApi.smsApiDailyLimit(), 30)
    assert.deepEqual(await sendScheduledReconfirmations(now), { reconfirmations: 0, reconfirmationErrors: 0 })
    process.env.SMSAPI_DAILY_LIMIT = '1'
    const job = { businessId: 'business-a', bookingId: 'booking-a', senderKey: 'smsapi', senderPhone: null,
      recipient: '+40700000000', message: 'Programare de test', idempotencyKey: 'fixture-1', kind: 'REMINDER' }
    const first = await smsLimits.enqueueLimitedSms(job)
    assert.deepEqual(await smsLimits.enqueueLimitedSms(job), first)
    await assert.rejects(smsLimits.enqueueLimitedSms({ ...job, idempotencyKey: 'fixture-2', kind: 'RECONFIRMATION' }), /a folosit deja SMS-ul/)
    await assert.rejects(smsLimits.enqueueLimitedSms({ ...job, businessId: 'business-b', bookingId: 'booking-b', idempotencyKey: 'fixture-3' }), /Plafonul BookEasy/)
    assert.equal(smsLimits.summarizeBookingSms([first], now).reconfirmationsLeft, 0)
    assert.equal(smsLimits.summarizeBookingSms([first], now, false).reconfirmationsLeft, 2)
    assert.equal(attempts.length, 1)
  } finally {
    for (const [name, value] of Object.entries({ BOOKEASY_SMS_PROVIDER: savedEnv.provider, SMSAPI_DAILY_LIMIT: savedEnv.limit, SMSAPI_AUTO_RECONFIRMATION: savedEnv.auto })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
  console.log('PASS SMS economy: automation off, single booking allowance, idempotency and platform-wide quota')
}
;(async()=>{await testCancellation();await testMeta();await testBusinessMapLocation();await testSmsApi();await testSmsApiPreflight();await testSmsEconomy()})().catch(e=>{console.error(e);process.exitCode=1});
