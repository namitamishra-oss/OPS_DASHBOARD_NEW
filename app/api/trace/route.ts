// app/api/trace/route.ts
import { NextResponse } from 'next/server'
import clickhouse from '@/lib/clickhouse'

const DB = 'goflipo'

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeInt(v: any, fallback: number): number {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function safeHours(v: any): number {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 24
}

/** Build timestamp WHERE fragment (no AND prefix) */
/** Normalize datetime string for ClickHouse DateTime64(3)
 *  datetime-local HTML input gives: "2026-06-18T00:00" (no seconds, T separator)
 *  ClickHouse needs:               "2026-06-18 00:00:00"
 */
function normDt(dt: string): string {
  if (!dt) return dt
  // Replace T with space, append :00 if seconds are missing
  const s = dt.replace('T', ' ')
  return s.length === 16 ? s + ':00' : s
}

function timeClause(hours: number, days: number, from: string, to: string): string {
  if (from && to) return `timestamp BETWEEN '${normDt(from)}' AND '${normDt(to)}'`
  if (days > 0)   return `timestamp >= now() - INTERVAL ${days} DAY`
  return `timestamp >= now() - INTERVAL ${hours} HOUR`
}

/**
 * pe_id is UInt64 — LIKE needs toString().
 * Domestic = pe_id NOT starting with 2026
 * International = pe_id starting with 2026
 */
function trafficFilter(traffic: string): string {
  if (traffic === 'international') return "toString(pe_id) LIKE '2026%'"
  if (traffic === 'domestic')      return "toString(pe_id) NOT LIKE '2026%'"
  return '' // all
}

export async function GET(request: Request) {
  const sp       = new URL(request.url).searchParams
  const hours    = safeHours(sp.get('hours'))
  const days     = safeInt(sp.get('days'), 0)
  const from     = sp.get('from')    ?? ''
  const to       = sp.get('to')      ?? ''
  const traffic  = (sp.get('traffic') ?? 'all').toLowerCase()
  const code     = sp.get('code')    ?? ''
  const sender   = sp.get('sender')  ?? ''
  const peId     = sp.get('pe_id')   ?? ''
  const authcode = sp.get('authcode') ?? ''
  const search   = sp.get('search')  ?? ''   // multi-field: sender, pe_id, ip, authcode, recipient
  const page     = Math.max(1, safeInt(sp.get('page'),  1))
  const limit    = Math.min(100, safeInt(sp.get('limit'), 50))
  const offset   = (page - 1) * limit

  // Build WHERE clause from parts (always start with time)
  const parts: string[] = [ timeClause(hours, days, from, to) ]

  const tfc = trafficFilter(traffic)
  if (tfc) parts.push(tfc)

  if (code)     parts.push(`dlr_code = ${parseInt(code) || 0}`)   // dlr_code is UInt16
  if (sender)   parts.push(`sender_id = '${sender.replace(/'/g, "''")}'`)
  if (peId)     parts.push(`toString(pe_id) = '${peId.replace(/'/g, "''")}'`)
  if (authcode) parts.push(`position(toString(authcode), '${authcode.replace(/'/g, "''")}') > 0`)
  if (search) {
    const s = search.replace(/'/g, "''")
    // Search across: sender_id (String), toString(pe_id), originator_ip (String),
    // toString(authcode), toString(recipient_number), error_message (String)
    parts.push([
      `sender_id LIKE '%${s}%'`,
      `toString(pe_id) LIKE '%${s}%'`,
      `originator_ip LIKE '%${s}%'`,
      `toString(authcode) LIKE '%${s}%'`,
      `toString(recipient_number) LIKE '%${s}%'`,
      `error_message LIKE '%${s}%'`,
    ].join(' OR '))
  }

  const WHERE = parts.join(' AND ')

  // Base time clause only (for code/sender dropdown lists — unaffected by row filters)
  const baseWhere = [timeClause(hours, days, from, to), tfc].filter(Boolean).join(' AND ')

  try {
    const [kpiRes, codesRes, sendersRes, rowsRes, countRes] = await Promise.all([

      // 1. KPIs
      clickhouse.query({
        query: `
          SELECT
            uniq(authcode)                              AS messages,
            sum(total_segments)                          AS segments,
            count()                                      AS rows,
            sumIf(total_segments, dispatch_status = 1)   AS passed,
            sumIf(total_segments, dispatch_status != 1)  AS blocked,
            uniq(sender_id)                              AS distinct_senders
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
        `,
        format: 'JSONEachRow',
      }),

      // 2. Error code chips (based on base window + traffic only, not row filters)
      clickhouse.query({
        query: `
          SELECT
            dlr_code                                AS code,
            count()                                 AS total,
            round(count() * 100.0 /
              (SELECT count() FROM ${DB}.sms_cdr WHERE ${baseWhere}), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${baseWhere} AND dlr_code != 0
          GROUP BY dlr_code
          ORDER BY total DESC
          LIMIT 12
        `,
        format: 'JSONEachRow',
      }),

      // 3. Sender list for dropdown
      clickhouse.query({
        query: `
          SELECT DISTINCT sender_id AS sender
          FROM ${DB}.sms_cdr
          WHERE ${baseWhere} AND sender_id != ''
          ORDER BY sender_id ASC
          LIMIT 100
        `,
        format: 'JSONEachRow',
      }),

      // 4. Paginated rows — includes authcode
      clickhouse.query({
        query: `
          SELECT
            timestamp,
            toString(authcode)    AS authcode,
            sender_id             AS sender,
            toString(pe_id)       AS pe_id,
            originator_ip         AS ip,
            toString(recipient_number) AS recipient,
            dlr_code              AS code,
            validation_step       AS step,
            error_message,
            dispatch_status,
            total_segments,
            segment_seqnum
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
          ORDER BY timestamp DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `,
        format: 'JSONEachRow',
      }),

      // 5. Total count
      clickhouse.query({
        query: `SELECT count() AS total FROM ${DB}.sms_cdr WHERE ${WHERE}`,
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

    const TONES = ['coral','amber','purple','teal','coral','amber','purple','teal','coral','amber','purple','teal']
    const kpi = kpiRaw[0] ?? {}

    return NextResponse.json({
      kpis: {
        messages:        Number(kpi.messages        ?? 0),
        segments:        Number(kpi.segments        ?? 0),
        total:           Number(kpi.segments        ?? kpi.total ?? 0),
        passed:          Number(kpi.passed          ?? 0),
        blocked:         Number(kpi.blocked         ?? 0),
        distinctSenders: Number(kpi.distinct_senders ?? 0),
      },
      codes:   codeChips.map((c, i) => ({ code: c.code, count: Number(c.total), pct: Number(c.pct), tone: TONES[i % 12] })),
      senders: senderList.map(s => s.sender),
      rows:    rows.map((r, i) => ({
        uuid:      `tr-${offset + i}`,
        ts:        r.timestamp,
        authcode:  r.authcode,
        sender:    r.sender,
        peId:      r.pe_id,
        recipient: r.recipient,
        ip:        r.ip,
        code:      r.code,
        step:          r.step,
        errMsg:        r.error_message ?? '',
        status:        r.dispatch_status,
        totalSegments: Number(r.total_segments ?? 1),
        segmentSeq:    Number(r.segment_seqnum ?? 1),
      })),
      pagination: {
        total: Number(countRaw[0]?.total ?? 0),
        page,
        limit,
        pages: Math.ceil(Number(countRaw[0]?.total ?? 0) / limit),
      },
    })
  } catch (err: any) {
    console.error('[Trace API]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}