// TEMPORARY FILE — app/api/ch-explore/route.ts
// Yeh ClickHouse mein databases aur tables dhundhega
// Use karo, phir delete kar dena

import { NextResponse } from 'next/server'
import clickhouse from '@/lib/clickhouse'

export async function GET() {
  const results: any = {}

  try {
    // Step 1: Kaunse databases hain?
    const dbs = await clickhouse.query({ query: 'SHOW DATABASES', format: 'JSONEachRow' })
    results.databases = await dbs.json()
  } catch(e) { results.databases_error = String(e) }

  try {
    // Step 2: Default database mein kaunsi tables hain?
    const tables = await clickhouse.query({ query: 'SHOW TABLES', format: 'JSONEachRow' })
    results.tables_in_default = await tables.json()
  } catch(e) { results.tables_default_error = String(e) }

  try {
    // Step 3: Saari databases ki saari tables
    const allTables = await clickhouse.query({
      query: `SELECT database, name, engine FROM system.tables 
              WHERE database NOT IN ('system','information_schema','INFORMATION_SCHEMA')
              ORDER BY database, name`,
      format: 'JSONEachRow'
    })
    results.all_tables = await allTables.json()
  } catch(e) { results.all_tables_error = String(e) }

  return NextResponse.json(results, { status: 200 })
}