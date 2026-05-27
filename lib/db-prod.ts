// lib/db-prod.ts
// Yeh sirf READ operations ke liye hai — main_account, dlt_header, dlt_template
import { Pool } from 'pg'

const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  // Read-only connection — kabhi INSERT/UPDATE/DELETE mat karna iske through
  max: 10,
})

export async function queryProd(text: string, params?: any[]) {
  const client = await prodPool.connect()
  try {
    const result = await client.query(text, params)
    return result
  } finally {
    client.release()
  }
}