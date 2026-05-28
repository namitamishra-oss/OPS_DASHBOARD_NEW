// lib/db-own.ts
// Yeh write operations ke liye — sessions, settings, audit logs
import { Pool, QueryResultRow } from 'pg'

const ownPool = new Pool({
  connectionString: process.env.OWN_DATABASE_URL,
})

export async function queryOwn<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null)[]
) {
  const client = await ownPool.connect()
  try {
    const result = await client.query<T>(text, params)
    return result
  } finally {
    client.release()
  }
}