// app/api/mis/route.ts
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
  const hours = safeInt(searchParams.get('hours'), 24)
  const days  = safeInt(searchParams.get('days'),  0)
  const from  = searchParams.get('from')
  const to    = searchParams.get('to')
  const dim   = searchParams.get('dim')    || 'sender'   // sender | pe_id | ip | error_code | step
  const gran  = searchParams.get('gran')   || 'hourly'   // hourly | daily | weekly | monthly
  const tc    = timeClause(hours, days, from, to)

  const granFn: Record<string, string> = {
    hourly:  "formatDateTime(toStartOfHour(timestamp),  '%Y-%m-%d %H:00')",
    daily:   "formatDateTime(toStartOfDay(timestamp),   '%Y-%m-%d')",
    weekly:  "formatDateTime(toStartOfWeek(timestamp),  '%Y-W%V')",
    monthly: "formatDateTime(toStartOfMonth(timestamp), '%Y-%m')",
  }
  const dateFn = granFn[gran] ?? granFn.daily

  const dimCol: Record<string, string> = {
    sender:     'sender_id',
    pe_id:      'pe_id',
    ip:         'originator_ip',
    error_code: 'dlr_code',
    step:       'validation_step',
  }
  const groupCol = dimCol[dim] ?? 'sender_id'

  try {
    const [rowsRes, errorDistRes, senderBlockRes, kpiRes] = await Promise.all([

      // 1. Main MIS table — dimension × date granularity
      clickhouse.query({
        query: `
          SELECT
            ${groupCol}                                           AS dimension,
            ${dateFn}                                            AS date,
            count()                                              AS submitted,
            countIf(dispatch_status = 1)                        AS passed,
            countIf(dispatch_status != 1)                       AS blocked,
            round(countIf(dispatch_status = 1) * 100.0 / count(), 2) AS pass_pct,
            topK(1)(dlr_code)[1]                                AS top_err
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND ${groupCol} != ''
          GROUP BY dimension, date
          ORDER BY submitted DESC
          LIMIT 200
        `,
        format: 'JSONEachRow',
      }),

      // 2. Error code distribution
      clickhouse.query({
        query: `
          SELECT
            dlr_code                                             AS code,
            count()                                              AS total,
            round(count() * 100.0 / (SELECT count() FROM ${DB}.sms_cdr WHERE ${tc}), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND dlr_code != ''
          GROUP BY dlr_code
          ORDER BY total DESC
          LIMIT 8
        `,
        format: 'JSONEachRow',
      }),

      // 3. Sender block rates
      clickhouse.query({
        query: `
          SELECT
            sender_id                                            AS sender,
            count()                                              AS total,
            countIf(dispatch_status != 1)                       AS blocked,
            round(countIf(dispatch_status != 1) * 100.0 / count(), 1) AS block_pct
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND sender_id != ''
          GROUP BY sender_id
          ORDER BY total DESC
          LIMIT 12
        `,
        format: 'JSONEachRow',
      }),

      // 4. Overall KPIs
      clickhouse.query({
        query: `
          SELECT
            count()                                              AS total_submitted,
            countIf(dispatch_status = 1)                        AS total_passed,
            countIf(dispatch_status != 1)                       AS total_blocked,
            uniq(sender_id)                                      AS distinct_senders,
            topK(1)(dlr_code)[1]                                AS top_error
          FROM ${DB}.sms_cdr
          WHERE ${tc}
        `,
        format: 'JSONEachRow',
      }),
    ])

    const [rows, errorDist, senderBlock, kpiRaw] = await Promise.all([
      rowsRes.json<any[]>(),
      errorDistRes.json<any[]>(),
      senderBlockRes.json<any[]>(),
      kpiRes.json<any[]>(),
    ])

    const tones = ['coral', 'amber', 'purple', 'teal', 'coral', 'amber', 'purple', 'teal']
    const kpi   = kpiRaw[0] ?? {}

    return NextResponse.json({
      kpis: {
        totalSubmitted: Number(kpi.total_submitted ?? 0),
        totalPassed:    Number(kpi.total_passed    ?? 0),
        totalBlocked:   Number(kpi.total_blocked   ?? 0),
        distinctSenders: Number(kpi.distinct_senders ?? 0),
        topError:       kpi.top_error ?? '—',
      },
      rows: rows.map((r) => ({
        dimension: r.dimension,
        date:      r.date,
        submitted: Number(r.submitted),
        passed:    Number(r.passed),
        blocked:   Number(r.blocked),
        passPct:   Number(r.pass_pct),
        topErr:    r.top_err || '—',
      })),
      errorDist: errorDist.map((e, i) => ({
        code:  e.code,
        count: Number(e.total),
        pct:   Number(e.pct),
        tone:  tones[i % tones.length],
      })),
      senderBlock: senderBlock.map((s) => ({
        sender:   s.sender,
        total:    Number(s.total),
        blocked:  Number(s.blocked),
        blockPct: Number(s.block_pct),
      })),
    })
  } catch (err: any) {
    console.error('[MIS API] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}