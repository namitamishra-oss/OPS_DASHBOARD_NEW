// app/api/test/route.ts
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import clickhouse from '@/lib/clickhouse'

export async function GET() {
  try {
    // Postgres test
    const pgResult = await query('SELECT NOW() as time')
    
    // ClickHouse test
    const chResult = await clickhouse.query({
      query: 'SELECT now() as time',
      format: 'JSONEachRow'
    })
    const chData = await chResult.json()

    return NextResponse.json({
      postgres: pgResult.rows[0],
      clickhouse: chData
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}