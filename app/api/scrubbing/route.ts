// app/api/scrubbing/route.ts
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
  const sp       = new URL(request.url).searchParams
  const hours    = safeHours(sp.get('hours'))
  const days     = safeInt(sp.get('days'), 0)
  const from     = sp.get('from')    ?? ''
  const to       = sp.get('to')      ?? ''
  const traffic  = (sp.get('traffic') ?? 'all').toLowerCase()
  const step     = sp.get('step')    ?? ''
  const search   = sp.get('search')  ?? ''
  const authcode = sp.get('authcode') ?? ''
  const sender   = sp.get('sender')  ?? ''

  const tc  = timeClause(hours, days, from, to)
  const tfc = trafficFilter(traffic)

  // Base = time + traffic (used for code/step lists)
  const baseParts = [tc, tfc].filter(Boolean)
  const baseWhere = baseParts.join(' AND ')

  // Full filter = base + blocked + step + search
  const filterParts = [...baseParts, 'dispatch_status != 1']
  if (step)     filterParts.push(`validation_step = '${step.replace(/'/g, "''")}'`)
  if (sender)   filterParts.push(`sender_id = '${sender.replace(/'/g, "''")}'`)
  if (authcode) filterParts.push(`position(toString(authcode), '${authcode.replace(/'/g, "''")}') > 0`)
  if (search) {
    const s = search.replace(/'/g, "''")
    filterParts.push([
      `sender_id LIKE '%${s}%'`,
      `toString(pe_id) LIKE '%${s}%'`,
      `originator_ip LIKE '%${s}%'`,
      `toString(authcode) LIKE '%${s}%'`,
      `toString(recipient_number) LIKE '%${s}%'`,
      `error_message LIKE '%${s}%'`,
    ].join(' OR '))
  }
  const blockWhere = filterParts.join(' AND ')

  try {
    const [kpiRes, stepRes, codeRes, ipRes, logRes] = await Promise.all([

      // 1. KPIs
      clickhouse.query({
        query: `
          SELECT
            uniq(authcode)                              AS messages,
            sum(total_segments)                          AS segments,
            count()                                      AS rows,
            sumIf(total_segments, dispatch_status = 1)   AS total_passed,
            sumIf(total_segments, dispatch_status != 1)  AS total_blocked,
            toString(topK(1)(validation_step)[1])        AS worst_step,
            toString(topK(1)(dlr_code)[1])               AS top_error
          FROM ${DB}.sms_cdr
          WHERE ${baseWhere}
        `,
        format: 'JSONEachRow',
      }),

      // 2. Blocks by validation step
      clickhouse.query({
        query: `
          SELECT
            validation_step AS step,
            count()         AS count
          FROM ${DB}.sms_cdr
          WHERE ${baseWhere} AND dispatch_status != 1 AND validation_step != ''
          GROUP BY validation_step
          ORDER BY count DESC
          LIMIT 8
        `,
        format: 'JSONEachRow',
      }),

      // 3. Error codes (within step filter if any)
      clickhouse.query({
        query: `
          SELECT
            dlr_code AS code,
            count()  AS total,
            round(count() * 100.0 /
              (SELECT count() FROM ${DB}.sms_cdr WHERE ${baseWhere} AND dispatch_status != 1), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${blockWhere} AND dlr_code != 0
          GROUP BY dlr_code
          ORDER BY total DESC
          LIMIT 10
        `,
        format: 'JSONEachRow',
      }),

      // 4. Top source IPs
      clickhouse.query({
        query: `
          SELECT
            originator_ip AS ip,
            count()       AS count,
            round(count() * 100.0 /
              (SELECT count() FROM ${DB}.sms_cdr WHERE ${baseWhere} AND dispatch_status != 1), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${blockWhere} AND originator_ip != ''
          GROUP BY originator_ip
          ORDER BY count DESC
          LIMIT 6
        `,
        format: 'JSONEachRow',
      }),

      // 5. Block audit log — includes authcode
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
            total_segments,
            segment_seqnum
          FROM ${DB}.sms_cdr
          WHERE ${blockWhere}
          ORDER BY timestamp DESC
          LIMIT 50
        `,
        format: 'JSONEachRow',
      }),
    ])

    const [kpiRaw, stepBreak, codeList, ips, log] = await Promise.all([
      kpiRes.json<any[]>(),
      stepRes.json<any[]>(),
      codeRes.json<any[]>(),
      ipRes.json<any[]>(),
      logRes.json<any[]>(),
    ])

    const TONES = ['coral','amber','purple','teal','coral','amber','purple','teal']
    const kpi = kpiRaw[0] ?? {}
    const maxCount = Math.max(...stepBreak.map(s => Number(s.count)), 1)

    return NextResponse.json({
      kpis: {
        messages:       Number(kpi.messages        ?? 0),
        segments:       Number(kpi.segments        ?? 0),
        totalSubmitted: Number(kpi.segments        ?? kpi.total_submitted ?? 0),
        totalPassed:    Number(kpi.total_passed    ?? 0),
        totalBlocked:   Number(kpi.total_blocked   ?? 0),
        worstStep:      kpi.worst_step ?? '—',
        topError:       kpi.top_error  ?? '—',
      },
      steps: stepBreak.map((s, i) => ({
        step:  s.step,
        label: String(s.step).replace(/_/g, ' '),
        count: Number(s.count),
        pct:   Math.round((Number(s.count) / maxCount) * 100),
        tone:  TONES[i % 8],
      })),
      codes: codeList.map((c, i) => ({
        code:  c.code,
        count: Number(c.total),
        pct:   Number(c.pct),
        tone:  TONES[i % 8],
      })),
      ips: ips.map(ip => ({ ip: ip.ip, count: Number(ip.count), pct: Number(ip.pct) })),
      log: log.map((r, i) => ({
        uuid:      `blk-${i}`,
        ts:        r.timestamp,
        authcode:  r.authcode,
        sender:    r.sender,
        peId:      r.pe_id,
        recipient: r.recipient,
        ip:        r.ip,
        code:      r.code,
        step:          r.step,
        errMsg:        r.error_message ?? '',
        totalSegments: Number(r.total_segments ?? 1),
        segmentSeq:    Number(r.segment_seqnum ?? 1),
      })),
    })
  } catch (err: any) {
    console.error('[Scrubbing API]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}