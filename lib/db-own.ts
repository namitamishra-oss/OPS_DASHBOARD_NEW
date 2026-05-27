// lib/db-own.ts
// Yeh write operations ke liye — sessions, settings, audit logs
import { Pool } from 'pg'

const ownPool = new Pool({
  connectionString: process.env.OWN_DATABASE_URL,
})

export async function queryOwn(text: string, params?: any[]) {
  const client = await ownPool.connect()
  try {
    const result = await client.query(text, params)
    return result
  } finally {
    client.release()
  }
}