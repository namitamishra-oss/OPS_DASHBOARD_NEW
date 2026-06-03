// app/api/overview/route.ts
import { NextResponse } from 'next/server'
import clickhouse from '@/lib/clickhouse'

const DB = 'goflipo'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hours = parseInt(searchParams.get('hours') || '24')

  try {
    // ── 1. Top stats ──────────────────────────────────────────────────────────
    const [topStatsRes, topBlockerRes] = await Promise.all([
      clickhouse.query({
        query: `
          SELECT
            count()                                              AS total,
            countIf(d.is_success = 0)                           AS failed,
            countIf(s.dispatch_status = 2)                      AS in_block,
            round(countIf(d.is_success = 0) * 100.0 / count(), 2) AS fail_pct,
            countIf(s.dispatch_status = 0)                      AS body_none
          FROM ${DB}.sms_cdr s
          LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
          WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
        `,
        format: 'JSONEachRow'
      }),
      clickhouse.query({
        query: `
          SELECT validation_step AS top_blocker_step, count() AS cnt
          FROM ${DB}.sms_cdr
          WHERE timestamp >= now() - INTERVAL ${hours} HOUR
            AND dispatch_status != 1
            AND validation_step != ''
          GROUP BY validation_step
          ORDER BY cnt DESC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      }),
    ])

    const topStatsData  = await topStatsRes.json<any[]>()
    const topBlockerData = await topBlockerRes.json<any[]>()
    const topStats = [{
      ...topStatsData[0],
      top_blocker_step: topBlockerData[0]?.top_blocker_step || '—'
    }]

    // ── 2. Status counts ──────────────────────────────────────────────────────
    const statusRes = await clickhouse.query({
      query: `
        SELECT
          countIf(dispatch_status = 1) AS submitted,
          countIf(dispatch_status = 2) AS scrubbed,
          countIf(dispatch_status = 0) AS failed
        FROM ${DB}.sms_cdr
        WHERE timestamp >= now() - INTERVAL ${hours} HOUR
      `,
      format: 'JSONEachRow'
    })
    const statusCounts = await statusRes.json()

    // ── 3. Hourly trend for sparklines ────────────────────────────────────────
    const trendRes = await clickhouse.query({
      query: `
        SELECT
          toStartOfHour(timestamp)     AS hour,
          countIf(dispatch_status = 1) AS submitted,
          countIf(dispatch_status = 2) AS scrubbed,
          countIf(dispatch_status = 0) AS failed
        FROM ${DB}.sms_cdr
        WHERE timestamp >= now() - INTERVAL ${hours} HOUR
        GROUP BY hour
        ORDER BY hour ASC
      `,
      format: 'JSONEachRow'
    })
    const hourlyTrend = await trendRes.json()

    // ── 4. Failure reasons (top 10 error codes) ───────────────────────────────
    const failRes = await clickhouse.query({
      query: `
        SELECT
          s.dlr_code,
          any(d.description) AS description,
          any(d.validator)   AS validator,
          any(d.severity)    AS severity,
          count()            AS cnt
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
          AND d.is_success = 0
        GROUP BY s.dlr_code
        ORDER BY cnt DESC
        LIMIT 10
      `,
      format: 'JSONEachRow'
    })
    const failureReasonsRaw = await failRes.json<any[]>()
    const totalFailed = failureReasonsRaw.reduce((a, r) => a + Number(r.cnt), 0) || 1
    const failureReasons = failureReasonsRaw.map(r => ({
      ...r,
      pct: ((Number(r.cnt) / totalFailed) * 100).toFixed(1)
    }))

    // ── 5. Domestic vs International scores ──────────────────────────────────
    const scoreRes = await clickhouse.query({
      query: `
        SELECT
          if(toString(recipient_number) LIKE '91%', 'domestic', 'international') AS traffic_type,
          count()                        AS total,
          countIf(d.is_success = 1)      AS passed,
          countIf(d.is_success = 0)      AS blocked,
          round(countIf(d.is_success = 1) * 100.0 / count(), 1) AS pass_rate
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
        GROUP BY traffic_type
      `,
      format: 'JSONEachRow'
    })
    const scores = await scoreRes.json()

    // ── 6. Key metrics ────────────────────────────────────────────────────────
    const kmRes = await clickhouse.query({
      query: `
        SELECT
          count()                        AS submission,
          countIf(dispatch_status = 2)   AS scrubbing,
          countIf(dispatch_status = 0)   AS in_block,
          round(countIf(d.is_success = 1) * 100.0 / count(), 1) AS pass_rate
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
      `,
      format: 'JSONEachRow'
    })
    const keyMetrics = await kmRes.json()

    // ── 7. Top senders ────────────────────────────────────────────────────────
    const senderRes = await clickhouse.query({
      query: `
        SELECT
          sender_id,
          count()                      AS total,
          countIf(d.is_success = 0)    AS blocked,
          round(countIf(d.is_success = 0) * 100.0 / count(), 1) AS block_pct
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
        GROUP BY sender_id
        ORDER BY total DESC
        LIMIT 5
      `,
      format: 'JSONEachRow'
    })
    const topSenders = await senderRes.json()

    // ── 8. Tail of pipeline (last 10) ─────────────────────────────────────────
    const tailRes = await clickhouse.query({
      query: `
        SELECT
          s.timestamp,
          s.sender_id,
          s.pe_id,
          s.originator_ip,
          s.dlr_code,
          s.dispatch_status,
          s.validation_step,
          d.description,
          d.is_success
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
        ORDER BY s.timestamp DESC
        LIMIT 10
      `,
      format: 'JSONEachRow'
    })
    const tailLogs = await tailRes.json()

    // ── 9. Check results by validator ─────────────────────────────────────────
    const checkRes = await clickhouse.query({
      query: `
        SELECT
          d.validator,
          count()                      AS total,
          countIf(d.is_success = 0)    AS failed,
          round(countIf(d.is_success = 0) * 100.0 / count(), 1) AS fail_rate
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
          AND d.validator != ''
        GROUP BY d.validator
        ORDER BY failed DESC
      `,
      format: 'JSONEachRow'
    })
    const checkResults = await checkRes.json()

    // ── 10. Blocklist breakdown ───────────────────────────────────────────────
    const blockRes = await clickhouse.query({
      query: `
        SELECT
          any(d.description) AS reason,
          s.dlr_code,
          count()            AS cnt
        FROM ${DB}.sms_cdr s
        LEFT JOIN ${DB}.dlr_code_reference d ON s.dlr_code = d.dlr_code
        WHERE s.timestamp >= now() - INTERVAL ${hours} HOUR
          AND d.is_success = 0
        GROUP BY s.dlr_code
        ORDER BY cnt DESC
        LIMIT 7
      `,
      format: 'JSONEachRow'
    })
    const blocklistRaw = await blockRes.json<any[]>()
    const totalBlock = blocklistRaw.reduce((a, r) => a + Number(r.cnt), 0) || 1
    const blocklistBreakdown = blocklistRaw.map(r => ({
      ...r,
      pct: ((Number(r.cnt) / totalBlock) * 100).toFixed(1)
    }))

    return NextResponse.json({
      topStats,
      statusCounts,
      hourlyTrend,
      failureReasons,
      scores,
      keyMetrics,
      topSenders,
      tailLogs,
      checkResults,
      blocklistBreakdown,
    })

  } catch (error) {
    console.error('[Overview API]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}