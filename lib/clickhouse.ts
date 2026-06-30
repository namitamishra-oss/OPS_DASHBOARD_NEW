// lib/clickhouse.ts
import { createClient } from '@clickhouse/client'

const clickhouse = createClient({
  url:      process.env.CLICKHOUSE_HOST || '/10.171.73.63:8123',  // "url" not "host"
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  request_timeout: 30_000,
  compression: { response: true },
})



export async function testClickHouseConnection() {
  try {
    const result = await clickhouse.query({ query: 'SELECT 1 as test', format: 'JSONEachRow' })
    const data = await result.json()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export default clickhouse