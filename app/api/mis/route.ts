// app/api/mis/route.ts
import { NextResponse } from 'next/server'
import clickhouse from '@/lib/clickhouse'

const DB = 'goflipo'

function safeInt(v: any, fallback: number): number {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
function safeHours(v: any): number {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 24
}
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
function trafficFilter(traffic: string): string {
  if (traffic === 'international') return "toString(pe_id) LIKE '2026%'"
  if (traffic === 'domestic')      return "toString(pe_id) NOT LIKE '2026%'"
  return ''
}

export async function GET(request: Request) {
  const sp      = new URL(request.url).searchParams
  const hours   = safeHours(sp.get('hours'))
  const days    = safeInt(sp.get('days'), 0)
  const from    = sp.get('from')    ?? ''
  const to      = sp.get('to')      ?? ''
  const dim     = sp.get('dim')     ?? 'sender'
  const gran    = sp.get('gran')    ?? 'daily'
  const traffic = (sp.get('traffic') ?? 'all').toLowerCase()
  const search  = sp.get('search') ?? ''

  const tc  = timeClause(hours, days, from, to)
  const tfc = trafficFilter(traffic)
  const searchFilter = search ? [
    `sender_id LIKE '%${search.replace(/'/g, "''")}'`,
    `toString(pe_id) LIKE '%${search.replace(/'/g, "''")}'`,
    `originator_ip LIKE '%${search.replace(/'/g, "''")}'`,
    `toString(dlr_code) LIKE '%${search.replace(/'/g, "''")}'`,
    `validation_step LIKE '%${search.replace(/'/g, "''")}'`,
  ].join(' OR ') : ''
  const WHERE = [tc, tfc, searchFilter ? `(${searchFilter})` : ''].filter(Boolean).join(' AND ')

  const granFn: Record<string, string> = {
    hourly:  "formatDateTime(toStartOfHour(timestamp),  '%Y-%m-%d %H:00')",
    daily:   "formatDateTime(toStartOfDay(timestamp),   '%Y-%m-%d')",
    weekly:  "formatDateTime(toStartOfWeek(timestamp),  '%Y-W%V')",
    monthly: "formatDateTime(toStartOfMonth(timestamp), '%Y-%m')",
  }
  const dateFn = granFn[gran] ?? granFn.daily

  // For pe_id dimension we must cast to String for grouping
  const dimColMap: Record<string, string> = {
    sender:     'sender_id',
    pe_id:      'toString(pe_id)',
    ip:         'originator_ip',
    error_code: 'toString(dlr_code)',
    step:       'validation_step',
  }
  const groupExpr  = dimColMap[dim] ?? 'sender_id'
  // Filter out zeros/empties per type
  const dimFilter  = dim === 'error_code'
    ? 'dlr_code != 0'
    : dim === 'pe_id'
      ? 'pe_id != 0'
      : `${groupExpr} != ''`

  try {
    const [rowsRes, errorDistRes, senderBlockRes, kpiRes] = await Promise.all([

      clickhouse.query({
        query: `
          SELECT
            ${groupExpr}                                               AS dimension,
            ${dateFn}                                                  AS date,
            sum(total_segments)                                               AS submitted,
            sumIf(total_segments, dispatch_status = 1)                       AS passed,
            sumIf(total_segments, dispatch_status != 1)                      AS blocked,
            round(sumIf(total_segments, dispatch_status=1)*100.0/sum(total_segments),2) AS pass_pct,
            toString(topK(1)(dlr_code)[1])                            AS top_err
          FROM ${DB}.sms_cdr
          WHERE ${WHERE} AND ${dimFilter}
          GROUP BY dimension, date
          ORDER BY submitted DESC
          LIMIT 200
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `
          SELECT
            dlr_code AS code,
            count()  AS total,
            round(count() * 100.0 / (SELECT count() FROM ${DB}.sms_cdr WHERE ${WHERE}), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${WHERE} AND dlr_code != 0
          GROUP BY dlr_code
          ORDER BY total DESC
          LIMIT 8
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `
          SELECT
            sender_id AS sender,
            sum(total_segments)                                            AS total,
            sumIf(total_segments, dispatch_status != 1)                   AS blocked,
            round(sumIf(total_segments,dispatch_status!=1)*100.0/sum(total_segments),1) AS block_pct
          FROM ${DB}.sms_cdr
          WHERE ${WHERE} AND sender_id != ''
          GROUP BY sender_id
          ORDER BY total DESC
          LIMIT 12
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `
          SELECT
            uniq(authcode)                              AS messages,
            sum(total_segments)                          AS segments,
            count()                                      AS rows,
            sumIf(total_segments, dispatch_status = 1)   AS total_passed,
            sumIf(total_segments, dispatch_status != 1)  AS total_blocked,
            uniq(sender_id)                              AS distinct_senders,
            toString(topK(1)(dlr_code)[1])               AS top_error
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
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

    const TONES = ['coral','amber','purple','teal','coral','amber','purple','teal']
    const kpi = kpiRaw[0] ?? {}

    return NextResponse.json({
      kpis: {
        messages:        Number(kpi.messages         ?? 0),
        segments:        Number(kpi.segments         ?? 0),
        // totalSubmitted must match the table's "submitted" column (sum of total_segments)
        // so the Totals row always equals the sum of individual rows
        totalSubmitted:  Number(kpi.segments          ?? 0),
        totalPassed:     Number(kpi.total_passed     ?? 0),
        totalBlocked:    Number(kpi.total_blocked    ?? 0),
        distinctSenders: Number(kpi.distinct_senders ?? 0),
        topError:        kpi.top_error ?? '—',
      },
      rows: rows.map(r => ({
        dimension: r.dimension,
        date:      r.date,
        submitted: Number(r.submitted),
        passed:    Number(r.passed),
        blocked:   Number(r.blocked),
        passPct:   Number(r.pass_pct),
        topErr:    r.top_err || '—',
      })),
      errorDist:   errorDist.map((e, i) => ({ code: e.code, count: Number(e.total), pct: Number(e.pct), tone: TONES[i % 8] })),
      senderBlock: senderBlock.map(s => ({ sender: s.sender, total: Number(s.total), blocked: Number(s.blocked), blockPct: Number(s.block_pct) })),
    })
  } catch (err: any) {
    console.error('[MIS API]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}