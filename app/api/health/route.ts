import { NextResponse } from 'next/server'
import { queryProd } from '@/lib/db-prod'
import { queryOwn } from '@/lib/db-own'
import { testClickHouseConnection } from '@/lib/clickhouse'

export async function GET() {
  const results: any = {}

  // Prod Postgres check
  try {
    await queryProd('SELECT 1')
    results.prod_postgres = 'connected'
  } catch (e) {
    results.prod_postgres = `error: ${e}`
  }

  // Own Postgres check
  try {
    await queryOwn('SELECT 1')
    results.own_postgres = 'connected'
  } catch (e) {
    results.own_postgres = `error: ${e}`
  }

  // ClickHouse check
  const chResult = await testClickHouseConnection()
  results.clickhouse = chResult.success ? 'connected (VPN active)' : `error: ${chResult.error}`

  return NextResponse.json(results)
}