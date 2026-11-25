import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

// Count occurrences across all application text and JSON columns. Table and
// column identifiers come only from PostgreSQL's catalog, never from a client.
export async function countStorageReferences(needle: string) {
  const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT c.table_name::text AS table_name, c.column_name::text AS column_name
    FROM information_schema.columns AS c
    JOIN information_schema.tables AS t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
    ORDER BY c.table_name, c.column_name
  `
  if (!columns.length) throw new Error('database_audit_empty')
  let references = 0
  for (let offset = 0; offset < columns.length; offset += 40) {
    const checks = columns.slice(offset, offset + 40).map(column => {
      const table = Prisma.raw(quoteIdentifier(column.table_name))
      const field = Prisma.raw(quoteIdentifier(column.column_name))
      return Prisma.sql`SELECT COUNT(*) AS count FROM ${table}
        WHERE POSITION(LOWER(${needle}) IN LOWER(${field}::text)) > 0`
    })
    const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count FROM (${Prisma.join(checks, ' UNION ALL ')}) AS audit WHERE count > 0
    `)
    references += rows.reduce((sum, row) => sum + Number(row.count), 0)
  }
  return references
}
