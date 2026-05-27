// lib/clickhouse.ts
import { createClient } from '@clickhouse/client'

const clickhouse = createClient({
  host: process.env.CLICKHOUSE_HOST!,     // http://YOUR_IP:8123
  username: process.env.CLICKHOUSE_USER!,
  password: process.env.CLICKHOUSE_PASSWORD!,
  request_timeout: 30000,
  compression: {
    response: true,
  },
})

// Connection test function
export async function testClickHouseConnection() {
  try {
    const result = await clickhouse.query({
      query: 'SELECT 1 as test',
      format: 'JSONEachRow',
    })
    const data = await result.json()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export default clickhouse