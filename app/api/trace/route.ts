// app/api/trace/route.ts
import { NextResponse } from 'next/server'
import clickhouse from '@/lib/clickhouse'

const DB = 'goflipo'

function safeInt(v: any, fallback: number): number {
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function timeClause(hours: number, days: number, from: string | null, to: string | null) {
  if (from && to) return `timestamp BETWEEN '${from}' AND '${to}'`
  if (days > 0)   return `timestamp >= now() - INTERVAL ${days} DAY`
  return `timestamp >= now() - INTERVAL ${hours} HOUR`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hours   = safeInt(searchParams.get('hours'),  24)
  const days    = safeInt(searchParams.get('days'),   0)
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')
  const code    = searchParams.get('code')    || ''
  const sender  = searchParams.get('sender')  || ''
  const peId    = searchParams.get('pe_id')   || ''
  const search  = searchParams.get('search')  || ''   // MSISDN / UUID
  const page    = Math.max(1, safeInt(searchParams.get('page'), 1))
  const limit   = Math.min(100, safeInt(searchParams.get('limit'), 50))
  const offset  = (page - 1) * limit

  const tc = timeClause(hours, days, from, to)

  const filters: string[] = [tc]
  if (code)   filters.push(`dlr_code = '${code.replace(/'/g, "''")}'`)
  if (sender) filters.push(`sender_id = '${sender.replace(/'/g, "''")}'`)
  if (peId)   filters.push(`pe_id = '${peId.replace(/'/g, "''")}'`)
  if (search) {
    const s = search.replace(/'/g, "''")
    filters.push(`(pe_id LIKE '%${s}%' OR sender_id LIKE '%${s}%' OR originator_ip LIKE '%${s}%')`)
  }
  const WHERE = filters.join(' AND ')

  try {
    const [kpiRes, codesRes, sendersRes, rowsRes, countRes] = await Promise.all([

      // 1. KPIs for current filter
      clickhouse.query({
        query: `
          SELECT
            count()                              AS total,
            countIf(dispatch_status = 1)        AS passed,
            countIf(dispatch_status != 1)       AS blocked,
            uniq(sender_id)                      AS distinct_senders
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
        `,
        format: 'JSONEachRow',
      }),

      // 2. Error code chips for filter bar
      clickhouse.query({
        query: `
          SELECT
            dlr_code                             AS code,
            count()                              AS total,
            round(count() * 100.0 / (
              SELECT count() FROM ${DB}.sms_cdr WHERE ${tc}
            ), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND dlr_code != ''
          GROUP BY dlr_code
          ORDER BY total DESC
          LIMIT 12
        `,
        format: 'JSONEachRow',
      }),

      // 3. Sender list for filter dropdown
      clickhouse.query({
        query: `
          SELECT DISTINCT sender_id AS sender
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND sender_id != ''
          ORDER BY sender_id ASC
          LIMIT 100
        `,
        format: 'JSONEachRow',
      }),

      // 4. Paginated trace rows
      clickhouse.query({
        query: `
          SELECT
            timestamp,
            sender_id      AS sender,
            pe_id,
            originator_ip  AS ip,
            dlr_code       AS code,
            validation_step AS step,
            dispatch_status
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
          ORDER BY timestamp DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `,
        format: 'JSONEachRow',
      }),

      // 5. Total count for pagination
      clickhouse.query({
        query: `
          SELECT count() AS total
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
        `,
        format: 'JSONEachRow',
      }),
    ])

    const [kpiRaw, codeChips, senderList, rows, countRaw] = await Promise.all([
      kpiRes.json<any[]>(),
      codesRes.json<any[]>(),
      sendersRes.json<any[]>(),
      rowsRes.json<any[]>(),
      countRes.json<any[]>(),
    ])

    const tones = ['coral', 'amber', 'purple', 'teal', 'coral', 'amber', 'purple', 'teal', 'coral', 'amber', 'purple', 'teal']
    const kpi   = kpiRaw[0] ?? {}

    return NextResponse.json({
      kpis: {
        total:           Number(kpi.total           ?? 0),
        passed:          Number(kpi.passed          ?? 0),
        blocked:         Number(kpi.blocked         ?? 0),
        distinctSenders: Number(kpi.distinct_senders ?? 0),
      },
      codes: codeChips.map((c, i) => ({
        code:  c.code,
        count: Number(c.total),
        pct:   Number(c.pct),
        tone:  tones[i % tones.length],
      })),
      senders: senderList.map((s) => s.sender),
      rows: rows.map((r, i) => ({
        uuid:    `tr-${offset + i}-${r.sender}`,
        ts:      r.timestamp,
        sender:  r.sender,
        peId:    r.pe_id,
        ip:      r.ip,
        code:    r.code,
        step:    r.step,
        status:  r.dispatch_status,
      })),
      pagination: {
        total:    Number(countRaw[0]?.total ?? 0),
        page,
        limit,
        pages:    Math.ceil(Number(countRaw[0]?.total ?? 0) / limit),
      },
    })
  } catch (err: any) {
    console.error('[Trace API] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}