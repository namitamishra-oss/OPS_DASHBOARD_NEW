// app/api/failures/route.ts
import { NextResponse } from 'next/server'
import clickhouse from '@/lib/clickhouse'

const DB = 'goflipo'

// Convert time range params → ClickHouse WHERE clause
// alias: table alias prefix, e.g. 's' or 'sl' or '' (no prefix)
function timeClause(hours?: number, days?: number, from?: string, to?: string, alias = 's'): string {
  const col = alias ? `${alias}.timestamp` : 'timestamp'
  if (from && to)  return `${col} >= '${from}' AND ${col} <= '${to}'`
  if (days)        return `${col} >= now() - INTERVAL ${days} DAY`
  const h = hours ?? 24
  return `${col} >= now() - INTERVAL ${h} HOUR`
}

export async function GET(request: Request) {
  const p      = new URL(request.url).searchParams
  const hours  = p.get('hours')  ? parseInt(p.get('hours')!)  : undefined
  const days   = p.get('days')   ? parseInt(p.get('days')!)   : undefined
  const from   = p.get('from')   || undefined
  const to     = p.get('to')     || undefined
  const sender = p.get('sender') || ''
  const cat    = p.get('cat')    || ''

  // If no time param given, default to 24h
  const effectiveHours = (!hours && !days && !from) ? 24 : hours
  const WHERE = timeClause(effectiveHours, days, from, to, 's')
  const senderClause = sender ? `AND s.sender_id = '${sender.replace(/'/g,"''")}'` : ''
  const catClause    = cat    ? `AND d.validator  = '${cat.replace(/'/g,"''")}'`    : ''

  try {
    // ── 1. KPI totals ──────────────────────────────────────────────────────────
    const kpiRes = await clickhouse.query({
      query: `
        SELECT
          count()                                                AS total,
          countIf(d.is_success = 0)                             AS failed,
          round(countIf(d.is_success = 0)*100.0/count(), 2)    AS fail_pct,
          uniqExact(if(d.is_success=0, s.dlr_code, NULL))      AS distinct_codes,
          uniqExact(if(d.is_success=0, d.validator, NULL))     AS distinct_validators
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE} ${senderClause}
      `,
      format: 'JSONEachRow',
    })
    const kpi = (await kpiRes.json<any[]>())[0] ?? {}

    // ── 2. Failure category breakdown (by validator) ───────────────────────────
    const catRes = await clickhouse.query({
      query: `
        SELECT
          d.validator                                              AS validator,
          count()                                                  AS cnt,
          round(count()*100.0 / sum(count()) OVER (), 1)          AS pct
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE} AND d.is_success = 0 AND d.validator != ''
          ${senderClause}
        GROUP BY d.validator
        ORDER BY cnt DESC
        LIMIT 10
      `,
      format: 'JSONEachRow',
    })
    const categories = await catRes.json<any[]>()

    // ── 3. Top error codes ─────────────────────────────────────────────────────
    const codesRes = await clickhouse.query({
      query: `
        SELECT
          s.dlr_code,
          any(d.description)                                      AS name,
          any(d.validator)                                        AS validator,
          any(d.severity)                                         AS severity,
          count()                                                 AS cnt,
          round(count()*100.0 / sum(count()) OVER (), 1)         AS pct
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE} AND d.is_success = 0
          ${senderClause} ${catClause}
        GROUP BY s.dlr_code
        ORDER BY cnt DESC
        LIMIT 20
      `,
      format: 'JSONEachRow',
    })
    const errorCodes = await codesRes.json<any[]>()

    // ── 4. Top affected senders for top-5 codes ────────────────────────────────
    const topCodes = errorCodes.slice(0, 5).map((c: any) => `'${c.dlr_code}'`)
    let affectedBySender: Record<string, { sender_id: string; cnt: number }[]> = {}

    if (topCodes.length > 0) {
      const affRes = await clickhouse.query({
        query: `
          SELECT s.dlr_code, s.sender_id, count() AS cnt
          FROM ${DB}.sms_cdr s
          LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
          WHERE ${WHERE} AND s.dlr_code IN (${topCodes.join(',')}) AND d.is_success = 0
          GROUP BY s.dlr_code, s.sender_id
          ORDER BY s.dlr_code, cnt DESC
          LIMIT 30
        `,
        format: 'JSONEachRow',
      })
      const affRows = await affRes.json<any[]>()
      for (const r of affRows) {
        if (!affectedBySender[r.dlr_code]) affectedBySender[r.dlr_code] = []
        if (affectedBySender[r.dlr_code].length < 3)
          affectedBySender[r.dlr_code].push({ sender_id: r.sender_id, cnt: Number(r.cnt) })
      }
    }

    // ── 5. Failure % by sender (top 8) ────────────────────────────────────────
    const senderRes = await clickhouse.query({
      query: `
        SELECT
          s.sender_id,
          count()                                                AS total,
          countIf(d.is_success = 0)                             AS failed,
          round(countIf(d.is_success=0)*100.0/count(), 1)      AS fail_pct
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE}
        GROUP BY s.sender_id
        HAVING failed > 0
        ORDER BY failed DESC
        LIMIT 8
      `,
      format: 'JSONEachRow',
    })
    const bySender = await senderRes.json<any[]>()

    // ── 6. Failure % by originator IP /24 subnet ──────────────────────────────
    // operator_id doesn't exist in schema; group by IP prefix instead
    const ipRes = await clickhouse.query({
      query: `
        SELECT
          concat(
            splitByChar('.', s.originator_ip)[1], '.',
            splitByChar('.', s.originator_ip)[2], '.',
            splitByChar('.', s.originator_ip)[3], '.x'
          )                                                      AS ip_subnet,
          count()                                                AS total,
          countIf(d.is_success = 0)                             AS failed,
          round(countIf(d.is_success=0)*100.0/count(), 1)      AS fail_pct
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE} AND s.originator_ip != '' AND s.originator_ip IS NOT NULL
        GROUP BY ip_subnet
        HAVING failed > 0
        ORDER BY fail_pct DESC
        LIMIT 6
      `,
      format: 'JSONEachRow',
    })
    const bySubnet = await ipRes.json<any[]>()

    // ── 7. Failure % by validation step ───────────────────────────────────────
    const stepRes = await clickhouse.query({
      query: `
        SELECT
          s.validation_step                                      AS step,
          count()                                                AS total,
          countIf(d.is_success = 0)                             AS failed,
          round(countIf(d.is_success=0)*100.0/count(), 1)      AS fail_pct
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE} AND s.validation_step IS NOT NULL AND s.validation_step != ''
        GROUP BY s.validation_step
        HAVING failed > 0
        ORDER BY failed DESC
        LIMIT 8
      `,
      format: 'JSONEachRow',
    })
    const byStep = await stepRes.json<any[]>()

    // ── 8. Recent failure trace log (last 50) ─────────────────────────────────
    const traceRes = await clickhouse.query({
      query: `
        SELECT
          s.timestamp,
          s.sender_id,
          s.pe_id,
          s.originator_ip,
          s.validation_step,
          s.dlr_code,
          d.description,
          d.validator,
          d.severity
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE} AND d.is_success = 0
          ${senderClause} ${catClause}
        ORDER BY s.timestamp DESC
        LIMIT 50
      `,
      format: 'JSONEachRow',
    })
    const traceLog = await traceRes.json<any[]>()

    // ── 9. Hourly / periodic failure trend ────────────────────────────────────
    // Granularity: hour for ≤48h, day otherwise
    const useDayGranularity = (days && days >= 7) || false
    const trendRes = await clickhouse.query({
      query: `
        SELECT
          ${useDayGranularity
            ? 'toStartOfDay(s.timestamp)  AS bucket'
            : 'toStartOfHour(s.timestamp) AS bucket'
          },
          countIf(d.is_success = 0) AS failed,
          count()                   AS total
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE ${WHERE}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      format: 'JSONEachRow',
    })
    const trend = await trendRes.json<any[]>()

    // ── 10. Sender list for filter dropdown ───────────────────────────────────
    const slWHERE = timeClause(effectiveHours, days, from, to, '')
    const senderListRes = await clickhouse.query({
      query: `
        SELECT DISTINCT sender_id
        FROM ${DB}.sms_cdr
        WHERE ${slWHERE}
        ORDER BY sender_id
        LIMIT 200
      `,
      format: 'JSONEachRow',
    })
    const senderList = (await senderListRes.json<any[]>()).map((r: any) => r.sender_id)

    return NextResponse.json({
      kpi, categories, errorCodes, affectedBySender,
      bySender, bySubnet, byStep,
      traceLog, trend, senderList,
    })
  } catch (error) {
    console.error('[Failures API]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}