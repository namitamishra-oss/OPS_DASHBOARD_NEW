import { NextResponse } from 'next/server'
import { queryProd } from '@/lib/db-prod'

export async function GET(request: Request) {
  const p      = new URL(request.url).searchParams
  const page   = parseInt(p.get('page')   || '1')
  const limit  = parseInt(p.get('limit')  || '50')
  const search = p.get('search') || ''
  const type   = p.get('type')   || ''
  const offset = (page - 1) * limit

  const conditions: string[] = ["ma.is_deleted = false"]
  const params: any[] = [limit, offset]
  let pi = 3

  if (search) {
    conditions.push(`(ma.email ILIKE $${pi} OR ma.name ILIKE $${pi} OR ma.phone ILIKE $${pi})`)
    params.push(`%${search}%`); pi++
  }
  if (type) {
    conditions.push(`ma.type = $${pi}`)
    params.push(type); pi++
  }

  const WHERE = conditions.join(' AND ')

  try {
    // Users list
    const usersRes = await queryProd(`
      SELECT
        ma.id::text,
        ma.created_at,
        ma.email,
        ma.name,
        ma.phone,
        ma.type,
        ma.status->'self'->>'status'       AS self_status,
        ma.status->'CEIND'->>'approval'    AS ceind_status
      FROM main_account ma
      WHERE ${WHERE}
      ORDER BY ma.created_at DESC
      LIMIT $1 OFFSET $2
    `, params)

    // Count
    const countParams = params.slice(2)
    const countConditions = conditions.slice()
    const countRes = await queryProd(`
      SELECT COUNT(*)::int AS count
      FROM main_account ma
      WHERE ${WHERE.replace(/\$(\d+)/g, (_, n) => `$${n - 2}`).replace('$-1', '$1')}
    `, countParams.length ? countParams : undefined)

    // Role distribution
    const roleRes = await queryProd(`
      SELECT type, COUNT(*)::int AS count
      FROM main_account
      WHERE is_deleted = false
      GROUP BY type
      ORDER BY count DESC
    `)

    // Top senders by volume (from ClickHouse perspective we use account name here)
    const topRes = await queryProd(`
      SELECT
        ma.id::text,
        ma.name,
        ma.email,
        ma.type,
        ma.created_at
      FROM main_account ma
      WHERE ma.is_deleted = false
        AND ma.type IN ('tm', 'pe')
      ORDER BY ma.created_at DESC
      LIMIT 20
    `)

    // New users last 7 days by role
    const newUsersRes = await queryProd(`
      SELECT type, COUNT(*)::int AS count
      FROM main_account
      WHERE is_deleted = false AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY type
      ORDER BY count DESC
    `)

    // Recent activity (latest created/updated accounts)
    const activityRes = await queryProd(`
      SELECT
        ma.id::text,
        ma.created_at                       AS ts,
        ma.updated_at,
        ma.name,
        ma.email,
        ma.type,
        ma.status->'self'->>'status'        AS self_status
      FROM main_account ma
      WHERE ma.is_deleted = false
      ORDER BY GREATEST(ma.created_at, ma.updated_at) DESC
      LIMIT 50
    `)

    return NextResponse.json({
      users:      usersRes.rows,
      total:      countRes.rows[0]?.count ?? 0,
      roleCounts: roleRes.rows,
      topUsers:   topRes.rows,
      newUsers7d: newUsersRes.rows,
      activity:   activityRes.rows,
    })
  } catch (err) {
    console.error('[Users API]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}