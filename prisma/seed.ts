import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Populăm baza de date cu businessul demo...')

  // ── Business ──────────────────────────────────────────────
  const business = await prisma.business.upsert({
    where: { slug: 'salon-bella-demo' },
    update: {},
    create: {
      name: 'Salon Bella',
      slug: 'salon-bella-demo',
      category: 'SALON',
      contactPhone: '+40745221900',
      city: 'Cluj-Napoca',
      address: 'Strada Memorandumului 12',
      latitude: 46.7712,
      longitude: 23.6236,
      publicListed: true,
      onboardingDone: true,
      onboardingStep: 5,
      rating: 4.8,
      reviewCount: 186,
    },
  })
  console.log(`✔ Business: ${business.name} (${business.slug})`)

  // ── Owner user ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('demo12345', 10)
  await prisma.user.upsert({
    where: { email: 'demo@bookeasy.ro' },
    update: {},
    create: {
      email: 'demo@bookeasy.ro',
      password: hashedPassword,
      role: 'OWNER',
      businessId: business.id,
    },
  })
  console.log('✔ Cont owner: demo@bookeasy.ro / demo12345')

  // ── Super admin (contul tău, acces la /superadmin) ────────
  const superAdminPassword = await bcrypt.hash('schimba-parola-asta', 10)
  await prisma.user.upsert({
    where: { email: 'admin@bookeasy.ro' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: 'admin@bookeasy.ro',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      businessId: null,
    },
  })
  console.log('✔ Cont super admin: admin@bookeasy.ro / schimba-parola-asta (schimbă parola după primul login!)')

  // ── Program de lucru (Luni-Vineri 09-18, Sâmbătă 09-14) ──
  await prisma.workingHours.deleteMany({ where: { businessId: business.id } })
  await prisma.workingHours.createMany({
    data: [
      { businessId: business.id, weekday: 1, startTime: '09:00', endTime: '18:00' },
      { businessId: business.id, weekday: 2, startTime: '09:00', endTime: '18:00' },
      { businessId: business.id, weekday: 3, startTime: '09:00', endTime: '18:00' },
      { businessId: business.id, weekday: 4, startTime: '09:00', endTime: '18:00' },
      { businessId: business.id, weekday: 5, startTime: '09:00', endTime: '18:00' },
      { businessId: business.id, weekday: 6, startTime: '09:00', endTime: '14:00' },
    ],
  })
  console.log('✔ Program de lucru')

  // ── Echipă ────────────────────────────────────────────────
  const staffNames = ['Ana', 'Daria', 'Mihai', 'Raluca']
  const staff = await Promise.all(
    staffNames.map((name) =>
      prisma.staff.upsert({
        where: { id: `demo-staff-${name.toLowerCase()}` },
        update: {},
        create: { id: `demo-staff-${name.toLowerCase()}`, businessId: business.id, name, active: true },
      })
    )
  )
  console.log(`✔ Echipă: ${staffNames.join(', ')}`)

  // ── Servicii ──────────────────────────────────────────────
  const servicesData = [
    { name: 'Tuns + vopsit', durationMin: 90, price: 150 },
    { name: 'Manichiură', durationMin: 45, price: 80 },
    { name: 'Coafură eveniment', durationMin: 60, price: 180 },
    { name: 'Bărbierit clasic', durationMin: 30, price: 60 },
    { name: 'Tratament facial', durationMin: 50, price: 120 },
    { name: 'Șuvițe', durationMin: 120, price: 250 },
  ]
  const services = await Promise.all(
    servicesData.map((s) =>
      prisma.service.upsert({
        where: { id: `demo-service-${s.name.toLowerCase().replace(/\s+/g, '-')}` },
        update: {},
        create: {
          id: `demo-service-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
          businessId: business.id,
          name: s.name,
          type: 'APPOINTMENT',
          durationMin: s.durationMin,
          price: s.price,
          active: true,
        },
      })
    )
  )
  console.log(`✔ ${services.length} servicii`)

  // ── Clienți demo ──────────────────────────────────────────
  const customersData = [
    { name: 'Ana Popescu', phone: '+40745111001' },
    { name: 'Mihai Radu', phone: '+40745111002' },
    { name: 'Ioana Dumitru', phone: '+40745111003' },
    { name: 'Vlad Marin', phone: '+40745111004' },
    { name: 'Cristina Vasile', phone: '+40745111005' },
    { name: 'Elena Dobre', phone: '+40745111006' },
  ]
  const customers = await Promise.all(
    customersData.map((c) =>
      prisma.customer.upsert({
        where: { businessId_phone: { businessId: business.id, phone: c.phone } },
        update: {},
        create: { businessId: business.id, name: c.name, phone: c.phone },
      })
    )
  )
  console.log(`✔ ${customers.length} clienți`)

  // ── Rezervări demo (azi + următoarele 5 zile) ────────────
  await prisma.booking.deleteMany({ where: { businessId: business.id, notes: 'DEMO_SEED' } })

  const channels: Array<'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'> = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK']
  const statuses: Array<'CONFIRMED' | 'PENDING'> = ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'PENDING']

  const bookingsToCreate = []
  for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
    const bookingsPerDay = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < bookingsPerDay; i++) {
      const date = new Date()
      date.setDate(date.getDate() + dayOffset)
      const hour = 9 + Math.floor(Math.random() * 8)
      date.setHours(hour, [0, 30][Math.floor(Math.random() * 2)], 0, 0)

      const service = services[Math.floor(Math.random() * services.length)]
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const staffMember = staff[Math.floor(Math.random() * staff.length)]
      const endDate = new Date(date.getTime() + (service.durationMin ?? 30) * 60000)

      bookingsToCreate.push({
        businessId: business.id,
        customerId: customer.id,
        serviceId: service.id,
        staffId: staffMember.id,
        startAt: date,
        endAt: endDate,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        channel: channels[Math.floor(Math.random() * channels.length)],
        notes: 'DEMO_SEED',
      })
    }
  }
  await prisma.booking.createMany({ data: bookingsToCreate })
  console.log(`✔ ${bookingsToCreate.length} rezervări demo`)

  // ── Recenzii demo (afișate pe /dashboard/statistici context) ──
  await prisma.review.deleteMany({ where: { businessId: business.id, source: 'demo' } })
  await prisma.review.createMany({
    data: [
      {
        businessId: business.id,
        source: 'demo',
        authorName: 'Cristina R.',
        rating: 5,
        comment: 'Rezervarea prin WhatsApp a fost super rapidă, iar Ana mi-a făcut o vopsire excelentă.',
        reply: 'Mulțumim frumos, Cristina! Te așteptăm cu drag data viitoare.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        businessId: business.id,
        source: 'demo',
        authorName: 'Mihai D.',
        rating: 4,
        comment: 'Am așteptat puțin peste programare, dar rezultatul a fost bun.',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
    ],
  })
  console.log('✔ Recenzii demo')

  console.log('\n🎉 Gata! Business demo populat cu succes.')
  console.log(`   Login dashboard: demo@bookeasy.ro / demo12345`)
  console.log(`   Pagină publică: /salon-bella-demo`)
  console.log(`   Hartă: /harta`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
