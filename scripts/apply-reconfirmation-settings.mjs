import { Client } from 'pg'

// The existing production build command runs before the application is released.
// This additive migration keeps old business settings enabled until owners change them.
if (process.env.VERCEL_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.startsWith('postgres')) throw new Error('DATABASE_URL lipsește din build-ul de producție.')
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query(`ALTER TABLE "Business"
      ADD COLUMN IF NOT EXISTS "smsReconfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "messengerReconfirmationEnabled" BOOLEAN NOT NULL DEFAULT true`)
  } finally {
    await client.end()
  }
}
