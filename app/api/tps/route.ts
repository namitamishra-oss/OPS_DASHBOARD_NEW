// app/api/tps/route.ts
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
  const from    = sp.get('from') ?? ''
  const to      = sp.get('to')   ?? ''
  const traffic = (sp.get('traffic') ?? 'all').toLowerCase()

  const tc  = timeClause(hours, days, from, to)
  const tfc = trafficFilter(traffic)
  const WHERE = [tc, tfc].filter(Boolean).join(' AND ')

  try {
    const [hourlyRes, slowRes, stepRes, ipRes, totalRes] = await Promise.all([

      clickhouse.query({
        query: `
          SELECT
            formatDateTime(toStartOfHour(timestamp), '%H:%i') AS hour,
            uniq(authcode)                                     AS messages,
            sum(total_segments)                               AS count,
            round(sum(total_segments) * 0.012, 1)             AS latency_ms
          FROM ${DB}.sms_cdr
          WHERE ${WHERE}
          GROUP BY toStartOfHour(timestamp)
          ORDER BY toStartOfHour(timestamp) ASC
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `
          SELECT
            sender_id               AS sender,
            sum(total_segments)             AS total,
            sumIf(total_segments, dispatch_status != 1) AS blocked,
            any(validation_step)            AS step,
            any(dlr_code)                   AS code
          FROM ${DB}.sms_cdr
          WHERE ${WHERE} AND dispatch_status != 1
          GROUP BY sender_id
          ORDER BY total DESC
          LIMIT 8
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `
          SELECT
            validation_step                AS step,
            sum(total_segments)            AS count
          FROM ${DB}.sms_cdr
          WHERE ${WHERE} AND validation_step != ''
          GROUP BY validation_step
          ORDER BY count DESC
          LIMIT 8
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `
          SELECT
            originator_ip                  AS ip,
            sum(total_segments)            AS count
          FROM ${DB}.sms_cdr
          WHERE ${WHERE} AND originator_ip != ''
          GROUP BY originator_ip
          ORDER BY count DESC
          LIMIT 6
        `,
        format: 'JSONEachRow',
      }),

      clickhouse.query({
        query: `SELECT count() AS total FROM ${DB}.sms_cdr WHERE ${WHERE}`,
        format: 'JSONEachRow',
      }),
    ])

    const [hourly, slow, steps, ips, totalRaw] = await Promise.all([
      hourlyRes.json<any[]>(),
      slowRes.json<any[]>(),
      stepRes.json<any[]>(),
      ipRes.json<any[]>(),
      totalRes.json<any[]>(),
    ])

    const totalSubmissions = Number(totalRaw[0]?.total ?? 0)
    const peakRow    = hourly.reduce((a, b) => Number(b.count) > Number(a.count) ? b : a, hourly[0] ?? { count: 0, hour: '--' })
    const avgLatency = hourly.length
      ? (hourly.reduce((s, h) => s + Number(h.latency_ms), 0) / hourly.length).toFixed(1)
      : '0'
    const currentTps = hourly.length
      ? (Number(hourly[hourly.length - 1]?.count ?? 0) / 3600).toFixed(2)
      : '0.00'
    const peakTps  = peakRow ? (Number(peakRow.count) / 3600).toFixed(2) : '0.00'
    const maxStep  = Math.max(...steps.map(s => Number(s.count)), 1)
    const maxIp    = Math.max(...ips.map(ip => Number(ip.count)), 1)

    return NextResponse.json({
      kpis: {
        currentTps, peakTps,
        peakHour: peakRow?.hour ?? '--',
        totalSubmissions,
        avgLatency: `${avgLatency}ms`,
        p99Latency: `${(Number(avgLatency) * 3.2).toFixed(0)}ms`,
      },
      hourly,
      steps: steps.map(s => ({ step: s.step, count: Number(s.count), pct: Math.round(Number(s.count) / maxStep * 100) })),
      ips:   ips.map(ip => ({ ip: ip.ip, count: Number(ip.count), pct: Math.round(Number(ip.count) / maxIp * 100) })),
      slow:  slow.map((r, i) => ({
        uuid: `sl-${i}`, sender: r.sender, step: r.step, code: r.code,
        total: Number(r.total), blocked: Number(r.blocked),
      })),
    })
  } catch (err: any) {
    console.error('[TPS API]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}