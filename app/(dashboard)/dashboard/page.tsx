'use client'

import { useEffect, useState, useRef } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const num = (v: any) => (v === undefined || v === null || v === '') ? 0 : Number(v)

function fmt(v: any): string {
  const x = num(v)
  if (x === 0) return '0'
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1) + 'M'
  if (x >= 1_000)     return (x / 1_000).toFixed(1) + 'K'
  return x.toLocaleString('en-IN')
}
function pct(v: any, decimals = 1): string {
  const x = num(v); return x.toFixed(decimals) + '%'
}
function ts(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour12: false }).slice(0,8) }
  catch { return iso.slice(11,19) }
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, h = 40 }: { data: number[]; color: string; h?: number }) {
  const w = 140
  if (!data || data.length < 2) return (
    <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', opacity: 0.3 }}>
      <div style={{ width: '100%', height: 1, background: color }} />
    </div>
  )
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (num(v) / max) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sp${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sp${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Bar chart (hourly submissions) ────────────────────────────────────────────
function HourlyChart({ data, color }: { data: any[]; color: string }) {
  if (!data.length) return <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11 }}>No data</div>
  const max = Math.max(...data.map(d => num(d.failed) + num(d.submitted) + num(d.scrubbed)), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72, padding: '0 4px' }}>
      {data.map((d, i) => {
        const total = num(d.failed) + num(d.submitted) + num(d.scrubbed)
        const barH = Math.max((total / max) * 68, 2)
        const hour = d.hour?.slice(11,13) || String(i).padStart(2,'0')
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: '100%', height: barH, background: color, borderRadius: '2px 2px 0 0', opacity: 0.8, minHeight: 2 }} title={`${hour}:00 — ${total}`} />
            {i % 4 === 0 && <span style={{ fontSize: 8, color: '#9ca3af' }}>{hour}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Stat badge ────────────────────────────────────────────────────────────────
function StatBadge({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
      background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b'
    }}>{ok ? 'OK' : 'FAIL'}</span>
  )
}

// ── DLR code badge ────────────────────────────────────────────────────────────
function CodeBadge({ code, ok }: { code: number; ok: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b',
      fontVariantNumeric: 'tabular-nums'
    }}>{code}</span>
  )
}

// ── Alert severity pill ───────────────────────────────────────────────────────
const ALERT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  urgent:   { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  look_into:{ bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  heads_up: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
}

// ── Horizontal progress bar ───────────────────────────────────────────────────
function ProgressBar({ val, color, height = 6 }: { val: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: '#f3f4f6', borderRadius: height/2, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${Math.min(val, 100)}%`, height: '100%', background: color, borderRadius: height/2, transition: 'width 0.7s ease' }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function OverviewPage() {
  const [apiData, setApiData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [hours,   setHours]   = useState(24)
  const [now,     setNow]     = useState('')
  const timer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('en-IN', { hour12: false }))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  const load = async (h: number) => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/overview?hours=${h}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setApiData(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load(hours)
    timer.current = setInterval(() => load(hours), 60_000)
    return () => clearInterval(timer.current)
  }, [hours])

  // ── Derived ────────────────────────────────────────────────────────────────
  const top    = apiData?.topStats?.[0]     ?? {}
  const counts = apiData?.statusCounts?.[0] ?? {}
  const km     = apiData?.keyMetrics?.[0]   ?? {}
  const trend  = apiData?.hourlyTrend       ?? []
  const dom    = apiData?.scores?.find((s:any) => s.traffic_type === 'domestic')      ?? {}
  const intl   = apiData?.scores?.find((s:any) => s.traffic_type === 'international') ?? {}

  const totalMsgs   = num(counts.submitted) + num(counts.scrubbed) + num(counts.failed)
  const failedTrend = trend.map((t:any) => num(t.failed))
  const subTrend    = trend.map((t:any) => num(t.submitted))

  // Peak hour
  const peakHour = trend.reduce((best:any, t:any) => {
    const total = num(t.failed)+num(t.submitted)+num(t.scrubbed)
    return total > (best.total || 0) ? { ...t, total } : best
  }, {})
  const idleHours = trend.filter((t:any) => num(t.failed)+num(t.submitted)+num(t.scrubbed) === 0).length

  // Generate alerts from data
  const alerts: any[] = []
  if (apiData) {
    const topSender = apiData.topSenders?.[0]
    if (topSender && num(topSender.block_pct) > 80) {
      alerts.push({
        type: 'urgent', age: 'LIVE',
        title: `${topSender.sender_id} is almost fully blocked`,
        body: `${fmt(topSender.blocked)} of ${fmt(topSender.total)} messages from ${topSender.sender_id} were rejected. Check operator IP registration.`,
        action: `Ask ${topSender.sender_id} for their TM IP, then add it to the whitelist`,
      })
    }
    if (num(top.fail_pct) > 90) {
      alerts.push({
        type: 'look_into', age: '30M',
        title: `${pct(top.fail_pct)} messages are being blocked`,
        body: `Top failure: ${apiData.failureReasons?.[0]?.description || 'Unknown'} (${apiData.failureReasons?.[0]?.dlr_code || '—'}). Immediate action required.`,
        action: 'Review operator IP whitelist or re-enable approved templates',
      })
    }
    if (apiData.checkResults?.some((c:any) => num(c.fail_rate) > 50)) {
      alerts.push({
        type: 'heads_up', age: '1H',
        title: 'High check failure rate detected',
        body: `One or more validators showing >50% failure rate. Check authcodes and route configuration.`,
        action: 'Renew authcodes with the principal entity (PE)',
      })
    }
  }

  // Colors — light theme
  const C = {
    teal:   '#0d9488', orange: '#ea580c', red: '#dc2626',
    green:  '#16a34a', purple: '#7c3aed', blue: '#2563eb',
    muted:  '#6b7280', text:   '#111827',
    sub:    '#374151', bg:     '#f9fafb',
    card:   '#ffffff', border: '#e5e7eb',
  }

  const cardStyle: React.CSSProperties = {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: '20px 22px',
  }

  return (
    <div style={{ padding: '20px 24px', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 13, color: C.text, minHeight: '100vh', background: C.bg }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          GOFLIPO SUPPORT · PIPELINE
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Overview</h1>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Scrubbing pipeline · last {hours}h · click a stage to drill into reasons
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[6, 24, 48].map(h => (
              <button key={h} onClick={() => setHours(h)} style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', border: `1px solid ${hours===h ? C.teal : C.border}`,
                background: hours===h ? '#ccfbf1' : C.card, color: hours===h ? C.teal : C.muted,
                fontWeight: hours===h ? 600 : 400,
              }}>{h}H</button>
            ))}
            <div style={{ fontSize: 11, color: C.muted, paddingLeft: 8 }}>
              <span style={{ color: '#16a34a', marginRight: 6 }}>●</span>SESSION · {now}
            </div>
            <button onClick={() => load(hours)} disabled={loading} style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'inherit', border: `1px solid ${C.teal}`, background: '#ccfbf1',
              color: C.teal, fontWeight: 600,
            }}>{loading ? '…' : '↺ REFRESH'}</button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 12,
          background: '#fef2f2', border: `1px solid #fca5a5`, color: C.red }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Summary banner ── */}
      <div style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 8, fontSize: 13,
        background: num(top.fail_pct) > 50 ? '#fff7ed' : '#f0fdf4',
        border: `1px solid ${num(top.fail_pct) > 50 ? '#fed7aa' : '#bbf7d0'}`,
        color: num(top.fail_pct) > 50 ? '#9a3412' : '#14532d' }}>
        ℹ In the last {hours}h we received{' '}
        <b>{fmt(totalMsgs)}</b> messages.{' '}
        <b style={{ color: C.green }}>{fmt(counts.submitted)}</b> went through{' '}
        ({pct(num(counts.submitted)/Math.max(totalMsgs,1)*100)} pass rate) and{' '}
        <b style={{ color: C.red }}>{fmt(counts.failed)}</b> were blocked.{' '}
        {apiData?.failureReasons?.[0] && (
          <>Most failures ({apiData.failureReasons[0].pct}%) are{' '}
          <b>{apiData.failureReasons[0].dlr_code} · {apiData.failureReasons[0].description}</b>{' '}
          — mainly from <b>{apiData?.topSenders?.[0]?.sender_id || '—'}</b>.</>
        )}{' '}
        {peakHour.hour && <>Busiest time was around <b>{peakHour.hour?.slice(11,13)}:00</b>.</>}
      </div>

      {/* ── 6 top stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'MESSAGES TODAY', value: fmt(totalMsgs),          sub: 'received in last ' + hours + 'h', color: C.text },
          { label: 'PASS RATE',      value: pct(km.pass_rate),        sub: `${fmt(km.submission)} delivered`, color: C.teal },
          { label: 'BLOCKED',        value: fmt(km.in_block),         sub: 'rejected by checks', color: C.red },
          { label: 'TOP REASON',     value: apiData?.failureReasons?.[0]?.dlr_code || '—', sub: apiData?.failureReasons?.[0]?.description || '—', color: C.orange, small: true },
          { label: 'BUSY HOUR',      value: peakHour.hour ? peakHour.hour.slice(11,13)+':00' : '—', sub: fmt(peakHour.total) + ' msgs', color: C.purple },
          { label: 'NEEDS ACTION',   value: String(alerts.length),    sub: 'open alerts to review', color: alerts.length > 0 ? C.red : C.green, dot: alerts.length > 0 },
        ].map(({ label, value, sub, color, small, dot }) => (
          <div key={label} style={cardStyle}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'inline-block' }} />}
              {label}
            </div>
            <div style={{ fontSize: small ? 16 : 24, fontWeight: 700, color, lineHeight: 1.1, wordBreak: 'break-word', marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Pipeline flow: Submitted / Scrubbed / Failed ── */}
      <div style={{ marginBottom: 6, fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ height: 1, width: 32, background: C.border }} />
        PIPELINE FLOW · CLICK TO DRILL
        <div style={{ height: 1, flex: 1, background: C.border }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr 24px 1fr', gap: 0, marginBottom: 16, alignItems: 'stretch' }}>
        {/* Submitted */}
        <div style={{ ...cardStyle, borderRadius: '12px 0 0 12px', borderRight: 0 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            SUBMITTED <span style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>GOFLIPO</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.teal, lineHeight: 1 }}>{fmt(counts.submitted)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{fmt(totalMsgs)} records · {pct(num(counts.submitted)/Math.max(totalMsgs,1)*100)}</div>
            </div>
            <Sparkline data={subTrend} color={C.teal} />
          </div>
        </div>
        <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 16 }}>›</div>
        {/* Scrubbed */}
        <div style={{ ...cardStyle, borderRadius: 0, borderRight: 0 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            GOFLIPO · SCRUBBED <span style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>PIPELINE</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.purple, lineHeight: 1 }}>{fmt(counts.scrubbed)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{fmt(counts.scrubbed)} records</div>
            </div>
            <Sparkline data={trend.map((t:any) => num(t.scrubbed))} color={C.purple} />
          </div>
        </div>
        <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 16 }}>›</div>
        {/* Failed */}
        <div style={{ ...cardStyle, borderRadius: '0 12px 12px 0' }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            GOFLIPO · REJECTED / BLOCKED <span style={{ fontSize: 9, color: C.red, fontWeight: 400 }}>▼</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.red, lineHeight: 1 }}>{fmt(counts.failed)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{fmt(counts.failed)} blocked · {pct(num(top.fail_pct))} variance</div>
            </div>
            <Sparkline data={failedTrend} color={C.red} />
          </div>
        </div>
      </div>

      {/* ── Failure reasons ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.red, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 2 }}>FAILED · REASONS</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Why submissions were blocked</div>
          </div>
          <span style={{ fontSize: 11, color: C.muted }}>total · {fmt(counts.failed)}</span>
        </div>
        {(!apiData?.failureReasons?.length) ? (
          <div style={{ color: C.muted, fontSize: 13 }}>No failures in this window 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {apiData.failureReasons.map((r:any) => {
              const barColor = num(r.pct) > 50 ? C.orange : num(r.pct) > 20 ? '#f59e0b' : '#fbbf24'
              return (
                <div key={r.dlr_code}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 120, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.dlr_code} · <span style={{ fontSize: 11, fontWeight: 500, color: C.sub }}>{r.description}</span></div>
                      <div style={{ fontSize: 11, color: C.muted }}>{r.validator}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ProgressBar val={num(r.pct)} color={barColor} height={8} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, width: 60, textAlign: 'right', flexShrink: 0 }}>{fmt(r.cnt)}</div>
                    <div style={{ fontSize: 12, color: C.orange, fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0 }}>{pct(r.pct)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ height: 2, width: 24, background: C.red, borderRadius: 1 }} />
            WHAT NEEDS ATTENTION RIGHT NOW
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(alerts.length, 3)}, 1fr)`, gap: 12 }}>
            {alerts.map((a, i) => {
              const s = ALERT_STYLES[a.type] || ALERT_STYLES.heads_up
              return (
                <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: s.text, color: '#fff', textTransform: 'uppercase' }}>{a.type.replace('_',' ')}</span>
                    <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{a.age} OLD</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, lineHeight: 1.5 }}>{a.body}</div>
                  <div style={{ fontSize: 11, color: s.text }}>→ {a.action}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 24H Throughput chart ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ height: 2, width: 24, background: C.border, borderRadius: 1 }} />
          24H THROUGHPUT · SUBMISSIONS / HOUR
        </div>
        <HourlyChart data={trend} color={C.teal} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 8 }}>
          <span>peak · {fmt(peakHour.total)} @ {peakHour.hour?.slice(11,13)||'—'}:00</span>
          <span>total · {fmt(totalMsgs)} submits</span>
          <span>idle hours · {idleHours}</span>
        </div>
      </div>

      {/* ── Scrub coverage + Source IP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Domestic + International side by side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 10, color: C.teal, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8 }}>DOMESTIC SCRUB · IN</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 40, fontWeight: 700, color: C.teal, lineHeight: 1 }}>{dom.pass_rate ? Math.round(num(dom.pass_rate)) : 0}</div>
                <div style={{ fontSize: 12, color: C.muted }}>domestic traffic</div>
              </div>
              <Sparkline data={subTrend} color={C.teal} h={40} />
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div><div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>PASSED</div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{fmt(dom.passed)}</div></div>
              <div><div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>BLOCKED</div><div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>{fmt(dom.blocked)}</div></div>
              <div><div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>PASS-RATE</div><div style={{ fontSize: 18, fontWeight: 700, color: C.teal }}>{pct(dom.pass_rate)}</div></div>
            </div>
          </div>
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 10, color: C.purple, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8 }}>INTERNATIONAL SCRUB</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 40, fontWeight: 700, color: C.purple, lineHeight: 1 }}>{intl.pass_rate ? Math.round(num(intl.pass_rate)) : 0}</div>
                <div style={{ fontSize: 12, color: C.muted }}>cross-border · roaming + intl</div>
              </div>
              <Sparkline data={trend.map((t:any) => num(t.scrubbed))} color={C.purple} h={40} />
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div><div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>PASSED</div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{fmt(intl.passed)}</div></div>
              <div><div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>BLOCKED</div><div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>{fmt(intl.blocked)}</div></div>
              <div><div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>PASS-RATE</div><div style={{ fontSize: 18, fontWeight: 700, color: C.purple }}>{pct(intl.pass_rate)}</div></div>
            </div>
          </div>
        </div>

        {/* Key metrics 4 cards */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ height: 2, width: 24, background: C.border, borderRadius: 1 }} />
            KEY METRICS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'SUBMITTED',  value: fmt(km.submission), sub: 'baseline', color: C.teal },
              { label: 'SCRUBBED',   value: fmt(km.scrubbing),  sub: `${num(km.submission)>0 ? pct(num(km.scrubbing)/num(km.submission)*100) : '0%'} drop`, color: C.purple },
              { label: 'BLOCKED',    value: fmt(km.in_block),   sub: `↑ ${pct(num(top.fail_pct))} variance`, color: C.red },
              { label: 'PASS RATE',  value: pct(km.pass_rate),  sub: `${fmt(num(km.submission)-num(km.in_block))} delivered`, color: C.orange },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={cardStyle}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Source IP + Tail of pipeline ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Top senders */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: C.orange, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>SOURCE IP INFRASTRUCTURE</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Where traffic originates</div>
          {(apiData?.topSenders || []).map((s:any) => (
            <div key={s.sender_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sender_id}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{num(s.block_pct) > 90 ? 'Fully blocked sender' : 'Active sender'}</div>
              </div>
              <ProgressBar val={num(s.block_pct)} color={num(s.block_pct) > 80 ? C.orange : C.teal} height={6} />
              <span style={{ fontSize: 12, fontWeight: 600, width: 50, textAlign: 'right', flexShrink: 0 }}>{fmt(s.total)}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                background: num(s.block_pct) > 80 ? '#fff7ed' : '#f0fdf4',
                color: num(s.block_pct) > 80 ? C.orange : C.green,
              }}>{pct(s.block_pct)}</span>
            </div>
          ))}
        </div>

        {/* Tail of pipeline */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: C.purple, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>LIVE TRACE · LAST SUBMISSIONS</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Tail of the pipeline</div>
          {(apiData?.tailLogs || []).map((l:any, i:number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, flexShrink: 0, width: 55 }}>{ts(l.timestamp)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.sender_id || '—'} · <span style={{ fontWeight: 400, color: C.muted }}>{l.pe_id}</span></div>
                <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.validation_step} · {l.description || (l.is_success ? 'delivered · OK' : 'blocked')}
                </div>
              </div>
              <CodeBadge code={l.dlr_code} ok={!!l.is_success} />
            </div>
          ))}
          {!apiData?.tailLogs?.length && <div style={{ color: C.muted, fontSize: 12 }}>No recent records</div>}
        </div>
      </div>

      {/* ── Check stack + Variance breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Check modules */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>GOFLIPO CHECK MODULES</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Check stack</div>
          {(apiData?.checkResults || []).map((r:any, i:number) => {
            const ok = num(r.fail_rate) < 10
            const icon = ok ? '✓' : num(r.fail_rate) < 30 ? '⚠' : '✕'
            const iconColor = ok ? C.green : num(r.fail_rate) < 30 ? C.orange : C.red
            return (
              <div key={r.validator} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: ok ? '#dcfce7' : '#fef2f2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: iconColor, flexShrink: 0, fontWeight: 700 }}>{icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.validator} Check</span>
                <span style={{ fontSize: 13, color: C.muted, width: 34, textAlign: 'right' }}>{fmt(r.total)}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 4,
                  background: ok ? '#dcfce7' : '#fee2e2',
                  color: ok ? C.green : C.red, width: 44, textAlign: 'center'
                }}>{pct(num(r.total) > 0 ? (num(r.total) - num(r.failed)) / num(r.total) * 100 : 0, 0)}</span>
              </div>
            )
          })}
        </div>

        {/* Variance breakdown */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: C.purple, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>VARIANCE BREAKDOWN</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Where volume is lost</div>
          {[
            { label: 'Submitted → Scrubbed', val: num(counts.submitted)>0 && totalMsgs>0 ? (1 - num(counts.scrubbed)/totalMsgs)*100 : 0, suffix: '% loss', color: C.teal },
            { label: 'Scrubbed → Final Pass', val: num(km.pass_rate), suffix: '%', color: C.purple },
            { label: 'Blocked (GoFlipo)',     val: num(top.fail_pct), suffix: '%',  color: C.orange },
            ...(apiData?.blocklistBreakdown || []).slice(0, 3).map((b:any) => ({
              label: b.reason, val: num(b.pct), suffix: '%', color: C.red
            }))
          ].map(({ label, val, suffix, color }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{val.toFixed(0)}{suffix}</span>
              </div>
              <ProgressBar val={val} color={color} height={8} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
