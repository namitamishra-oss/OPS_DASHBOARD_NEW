// app/api/scrubbing/route.ts
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
  const hours    = safeInt(searchParams.get('hours'), 24)
  const days     = safeInt(searchParams.get('days'),  0)
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const step     = searchParams.get('step') || ''   // filter by validation_step
  const tc       = timeClause(hours, days, from, to)
  const stepFilter = step ? `AND validation_step = '${step.replace(/'/g, "''")}'` : ''

  try {
    const [kpiRes, stepBreakRes, codesByStepRes, ipRes, logRes] = await Promise.all([

      // 1. KPIs
      clickhouse.query({
        query: `
          SELECT
            count()                                             AS total_submitted,
            countIf(dispatch_status = 1)                       AS total_passed,
            countIf(dispatch_status != 1)                      AS total_blocked,
            topK(1)(validation_step)[1]                        AS worst_step,
            topK(1)(dlr_code)[1]                               AS top_error
          FROM ${DB}.sms_cdr
          WHERE ${tc}
        `,
        format: 'JSONEachRow',
      }),

      // 2. Blocks by validation step
      clickhouse.query({
        query: `
          SELECT
            validation_step                                     AS step,
            count()                                             AS count
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND dispatch_status != 1 AND validation_step != ''
          GROUP BY validation_step
          ORDER BY count DESC
          LIMIT 8
        `,
        format: 'JSONEachRow',
      }),

      // 3. Error codes — optionally filtered by step
      clickhouse.query({
        query: `
          SELECT
            dlr_code                                            AS code,
            count()                                             AS total,
            round(count() * 100.0 / (
              SELECT count() FROM ${DB}.sms_cdr WHERE ${tc} AND dispatch_status != 1
            ), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND dispatch_status != 1 ${stepFilter}
          GROUP BY dlr_code
          ORDER BY total DESC
          LIMIT 10
        `,
        format: 'JSONEachRow',
      }),

      // 4. Top source IPs causing blocks
      clickhouse.query({
        query: `
          SELECT
            originator_ip                                       AS ip,
            count()                                             AS count,
            round(count() * 100.0 / (
              SELECT count() FROM ${DB}.sms_cdr WHERE ${tc} AND dispatch_status != 1
            ), 1) AS pct
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND dispatch_status != 1 AND originator_ip != ''
          GROUP BY originator_ip
          ORDER BY count DESC
          LIMIT 6
        `,
        format: 'JSONEachRow',
      }),

      // 5. Block audit log (last 50)
      clickhouse.query({
        query: `
          SELECT
            timestamp,
            sender_id           AS sender,
            pe_id,
            originator_ip       AS ip,
            dlr_code            AS code,
            validation_step     AS step
          FROM ${DB}.sms_cdr
          WHERE ${tc} AND dispatch_status != 1 ${stepFilter}
          ORDER BY timestamp DESC
          LIMIT 50
        `,
        format: 'JSONEachRow',
      }),
    ])

    const [kpiRaw, stepBreak, codesByStep, ips, log] = await Promise.all([
      kpiRes.json<any[]>(),
      stepBreakRes.json<any[]>(),
      codesByStepRes.json<any[]>(),
      ipRes.json<any[]>(),
      logRes.json<any[]>(),
    ])

    const tones = ['coral', 'amber', 'purple', 'teal', 'coral', 'amber', 'purple', 'teal']
    const kpi   = kpiRaw[0] ?? {}
    const maxStepCount = Math.max(...stepBreak.map((s) => Number(s.count)), 1)

    return NextResponse.json({
      kpis: {
        totalSubmitted: Number(kpi.total_submitted  ?? 0),
        totalPassed:    Number(kpi.total_passed     ?? 0),
        totalBlocked:   Number(kpi.total_blocked    ?? 0),
        worstStep:      kpi.worst_step ?? '—',
        topError:       kpi.top_error  ?? '—',
      },
      steps: stepBreak.map((s, i) => ({
        step:  s.step,
        label: s.step.replace(/_/g, ' '),
        count: Number(s.count),
        pct:   Math.round((Number(s.count) / maxStepCount) * 100),
        tone:  tones[i % tones.length],
      })),
      codes: codesByStep.map((c, i) => ({
        code:  c.code,
        count: Number(c.total),
        pct:   Number(c.pct),
        tone:  tones[i % tones.length],
      })),
      ips: ips.map((ip) => ({
        ip:    ip.ip,
        count: Number(ip.count),
        pct:   Number(ip.pct),
      })),
      log: log.map((r, i) => ({
        uuid:      `row-${i}`,
        ts:        r.timestamp,
        sender:    r.sender,
        peId:      r.pe_id,
        ip:        r.ip,
        code:      r.code,
        step:      r.step,
      })),
    })
  } catch (err: any) {
    console.error('[Scrubbing API] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}