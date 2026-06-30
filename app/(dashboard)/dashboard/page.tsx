'use client'

import React, { useEffect, useState } from 'react'
import { useDashboardControls } from '@/components/Topbar'

// ── Helpers ───────────────────────────────────────────────────────────────────
const num = (v: any) => (v === undefined || v === null || v === '') ? 0 : Number(v)
function fmt(v: any): string {
  const x = num(v)
  if (x === 0) return '0'
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1) + 'M'
  if (x >= 1_000)     return (x / 1_000).toFixed(1) + 'K'
  return x.toLocaleString('en-IN')
}
function pct(v: any, dec = 1): string { return num(v).toFixed(dec) + '%' }
function ts(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour12: false }).slice(0, 8) }
  catch { return iso.slice(11, 19) }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
type Tone = 'teal' | 'purple' | 'coral' | 'amber'
const TXT:  Record<Tone, string> = { teal: 'hsl(var(--teal-text))', purple: 'hsl(var(--purple-text))', coral: 'hsl(var(--coral-text))', amber: 'hsl(var(--amber-text))' }
const BG:   Record<Tone, string> = { teal: 'hsl(var(--teal-bg))', purple: 'hsl(var(--purple-bg))', coral: 'hsl(var(--coral-bg))', amber: 'hsl(var(--amber-bg))' }
const BDR:  Record<Tone, string> = { teal: 'hsl(var(--teal-border))', purple: 'hsl(var(--purple-border))', coral: 'hsl(var(--coral-border))', amber: 'hsl(var(--amber-border))' }

// ── Primitives ────────────────────────────────────────────────────────────────
function Pill({ children, tone }: { children: React.ReactNode; tone: Tone | 'success' | 'warning' | 'danger' | 'info' }) {
  const map: Record<string, [string, string]> = {
    teal: [BG.teal, TXT.teal], purple: [BG.purple, TXT.purple],
    coral: [BG.coral, TXT.coral], amber: [BG.amber, TXT.amber],
    success: ['hsl(var(--teal-bg))', 'hsl(var(--teal-text))'], warning: ['hsl(var(--amber-bg))', 'hsl(var(--amber-text))'],
    danger: ['hsl(var(--coral-bg))', 'hsl(var(--coral-text))'], info: ['hsl(var(--purple-bg))', 'hsl(var(--purple-text))'],
  }
  const [bg, text] = map[tone] ?? [BG.teal, TXT.teal]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: bg, color: text, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {children}
    </span>
  )
}

function Bar({ val, tone, height = 5 }: { val: number; tone: Tone; height?: number }) {
  return (
    <div style={{ height, background: 'hsl(var(--muted))', borderRadius: height / 2, overflow: 'hidden', flex: 1, minWidth: 40 }}>
      <div style={{ width: `${Math.min(val, 100)}%`, height: '100%', background: TXT[tone], borderRadius: height / 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function Panel({ children, tone, eyebrow, title, actions, style }: {
  children: React.ReactNode; tone: Tone; eyebrow?: string; title?: string
  actions?: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ background: 'hsl(var(--surface-1))', borderRadius: 12, border: `1px solid hsl(var(--border))`, borderTop: `3px solid ${TXT[tone]}`, overflow: 'hidden', ...style }}>
      {(eyebrow || title || actions) && (
        <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border))' }}>
          <div>
            {eyebrow && <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: TXT[tone], marginBottom: 2 }}>{eyebrow}</div>}
            {title   && <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{title}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

function SectionLabel({ tone = 'teal', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
      <div style={{ height: 1, width: 24, background: TXT[tone] }} />
      <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'hsl(var(--muted-foreground))' }}>{children}</span>
    </div>
  )
}

function Sparkline({ data, tone, w = 80, h = 28 }: { data: number[]; tone: Tone; w?: number; h?: number }) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (num(v) / max) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={TXT[tone]} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function StatusChip({ icon, label, value, sub, tone, live }: {
  icon?: string; label: string; value: React.ReactNode; sub?: string; tone: Tone; live?: boolean
}) {
  return (
    <div style={{ position: 'relative', borderRadius: 10, background: BG[tone], border: `1px solid ${BDR[tone]}`, padding: '10px 14px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: TXT[tone] }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TXT[tone], marginBottom: 4 }}>
        {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
        <span style={{ fontSize: 9.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em' }}>{label}</span>
        {live && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'hsl(var(--teal-text))', flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function LineChart({ data, tone }: { data: any[]; tone: Tone }) {
  if (!data || data.length < 2) return (
    <div style={{ height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No data</div>
  )
  const W = 780, H = 110, PAD = { top: 8, right: 8, bottom: 20, left: 36 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom

  const totals      = data.map(d => num(d.submitted) + num(d.failed) + num(d.scrubbed))
  const failedVals  = data.map(d => num(d.failed))
  const maxVal      = Math.max(...totals, 1)
  const peakIdx     = totals.indexOf(Math.max(...totals))

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * iW
  const toY = (v: number) => PAD.top + (1 - v / maxVal) * iH

  const totalPts  = data.map((_, i) => `${toX(i).toFixed(1)},${toY(totals[i]).toFixed(1)}`).join(' ')
  const failedPts = data.map((_, i) => `${toX(i).toFixed(1)},${toY(failedVals[i]).toFixed(1)}`).join(' ')

  // Area fill path for total
  const areaPath = `M ${toX(0)},${toY(totals[0])} ` +
    data.slice(1).map((_, i) => `L ${toX(i+1).toFixed(1)},${toY(totals[i+1]).toFixed(1)}`).join(' ') +
    ` L ${toX(data.length-1)},${PAD.top + iH} L ${toX(0)},${PAD.top + iH} Z`

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: Math.round(maxVal * f), y: toY(maxVal * f) }))

  // X axis labels (show ~8 evenly spaced)
  const xStep = Math.ceil(data.length / 8)
  const xLabels = data.map((d, i) => ({ i, label: d.hour?.slice(11, 13) || String(i), x: toX(i) })).filter((_, i) => i % xStep === 0)

  const gradId = `grad-${tone}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 128, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TXT[tone]} stopOpacity="0.18" />
          <stop offset="100%" stopColor={TXT[tone]} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t.v}>
          <line x1={PAD.left} y1={t.y} x2={PAD.left + iW} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
          <text x={PAD.left - 4} y={t.y + 3.5} textAnchor="end" fontSize="8" fontFamily="monospace" fill="#9ca3af">
            {t.v >= 1000 ? (t.v/1000).toFixed(0)+'k' : t.v}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Failed line (coral, dashed) */}
      <polyline points={failedPts} fill="none" stroke={TXT.coral} strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />

      {/* Total line */}
      <polyline points={totalPts} fill="none" stroke={TXT[tone]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Peak dot */}
      <circle cx={toX(peakIdx)} cy={toY(totals[peakIdx])} r="4" fill={TXT[tone]} />
      <circle cx={toX(peakIdx)} cy={toY(totals[peakIdx])} r="7" fill={TXT[tone]} fillOpacity="0.15" />

      {/* X axis labels */}
      {xLabels.map(l => (
        <text key={l.i} x={l.x} y={H - 2} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#9ca3af">{l.label}</text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PAD.left + iW - 120}, ${PAD.top})`}>
        <line x1="0" y1="5" x2="16" y2="5" stroke={TXT[tone]} strokeWidth="2" />
        <text x="20" y="8" fontSize="8" fontFamily="monospace" fill="#6b7280">Total</text>
        <line x1="54" y1="5" x2="70" y2="5" stroke={TXT.coral} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="74" y="8" fontSize="8" fontFamily="monospace" fill="#6b7280">Failed</text>
      </g>
    </svg>
  )
}

type DrillKey = 'submitted' | 'scrubbed' | 'failed'

function PipelineCard({ eyebrow, title, sub, tone, arrow, active, onClick }: {
  eyebrow: string; title: string; sub: string
  tone: Tone; arrow?: boolean; active?: boolean; onClick?: () => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      {arrow && (
        <div style={{ display: 'none', position: 'absolute', left: -12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', fontSize: 20, zIndex: 10 }}>›</div>
      )}
      <button type="button" onClick={onClick} style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: active ? BG[tone] : 'hsl(var(--surface-1))',
        border: `1px solid ${active ? TXT[tone] : 'hsl(var(--border))'}`,
        borderTop: `3px solid ${TXT[tone]}`,
        borderRadius: 12, padding: '16px 20px',
        transition: 'all 0.15s ease', outline: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
          {eyebrow}
          <span style={{ fontSize: 12, transform: active ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', color: active ? TXT[tone] : 'hsl(var(--muted-foreground))' }}>⌄</span>
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: TXT[tone], lineHeight: 1, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{sub}</div>
      </button>
    </div>
  )
}

function DrillShell({ tone, eyebrow, title, total, rows, onClose }: {
  tone: Tone; eyebrow: string; title: string; total: number; onClose: () => void
  rows: { label: string; sub: string; count: number; pct: number; tone: Tone }[]
}) {
  return (
    <Panel tone={tone} eyebrow={eyebrow} title={title}
      actions={
        <>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>total · {fmt(total)}</span>
          <button onClick={onClose} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid hsl(var(--border))', background: 'hsl(var(--surface-2))', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Close ✕
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 52px', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid hsl(var(--border))' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{r.label}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{r.sub}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bar val={r.pct} tone={r.tone} height={5} />
              <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', width: 44, textAlign: 'right', flexShrink: 0 }}>{fmt(r.count)}</span>
            </div>
            <Pill tone={r.tone}>{r.pct}%</Pill>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, padding: '16px 0', textAlign: 'center', fontFamily: 'monospace' }}>No data</div>}
      </div>
    </Panel>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function OverviewPage() {
  const { toApiParams, refreshTick } = useDashboardControls()

  const [apiData, setApiData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [drill,   setDrill]   = useState<DrillKey | null>('failed')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      const ap = toApiParams()
      if (ap.hours) params.set('hours', String(ap.hours))
      if (ap.days)  params.set('days',  String(ap.days))
      if (ap.from)  params.set('from',  ap.from as string)
      if (ap.to)    params.set('to',    ap.to as string)
      const res  = await fetch(`/api/overview?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setApiData(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [refreshTick])

  // ── Derived ────────────────────────────────────────────────────────────────
  const top     = apiData?.topStats?.[0]     ?? {}
  const counts  = apiData?.statusCounts?.[0] ?? {}
  const km      = apiData?.keyMetrics?.[0]   ?? {}
  const trend   = apiData?.hourlyTrend       ?? []
  const dom     = apiData?.scores?.find((s: any) => s.traffic_type === 'domestic')      ?? {}
  const intl    = apiData?.scores?.find((s: any) => s.traffic_type === 'international') ?? {}
  const reasons = apiData?.failureReasons    ?? []
  const checks  = apiData?.checkResults      ?? []
  const senders = apiData?.topSenders        ?? []
  const tail    = apiData?.pipelineTail      ?? []

  const totalMsgs   = num(counts.submitted) + num(counts.scrubbed) + num(counts.failed)
  const failedTotal = num(counts.failed)
  const passedTotal = Math.max(0, totalMsgs - failedTotal)
  const passRate    = totalMsgs > 0 ? ((passedTotal / totalMsgs) * 100).toFixed(1) : '0'
  const topErr      = reasons[0] ?? {}
  const topSender   = senders[0] ?? {}
  const peakHour    = trend.reduce((best: any, t: any) => {
    const total = num(t.submitted) + num(t.failed) + num(t.scrubbed)
    return total > (best._total || 0) ? { ...t, _total: total } : best
  }, {})
  const idleHours   = trend.filter((t: any) => num(t.submitted) + num(t.failed) + num(t.scrubbed) < 10).length

  // Generate ops alerts
  const alerts: { severity: string; tone: Tone; title: string; detail: string; action: string; age: string }[] = []
  if (apiData && senders.length) {
    if (num(topSender.block_pct) > 80) alerts.push({
      severity: 'Urgent', tone: 'coral',
      title: `${topSender.sender_id} is almost fully blocked`,
      detail: `${fmt(topSender.blocked)} of ${fmt(topSender.total)} messages from ${topSender.sender_id} were rejected. Sending IP may not be on the whitelist.`,
      action: `Ask ${topSender.sender_id} for their TM IP, then add it to the whitelist`,
      age: 'live',
    })
  }
  if (num(top.fail_pct) > 30) alerts.push({
    severity: 'Look into', tone: 'amber',
    title: `${pct(top.fail_pct)} messages are being blocked`,
    detail: `Top failure: ${topErr.description || 'Unknown'} (${topErr.dlr_code || '—'}). ${fmt(topErr.cnt || 0)} messages affected.`,
    action: 'Review operator IP whitelist or re-enable approved templates',
    age: '30m old',
  })
  if (checks.some((c: any) => num(c.fail_rate) > 50)) alerts.push({
    severity: 'Heads up', tone: 'purple',
    title: 'High check failure rate detected',
    detail: `One or more validators showing >50% failure rate. Check authcodes and route configuration.`,
    action: 'Renew authcodes with the principal entity (PE)',
    age: '1h old',
  })

  // Drill rows
  const drillRows: Record<DrillKey, any[]> = {
    submitted: senders.map((s: any) => ({
      label: s.sender_id, sub: `PEID · ${s.sender_id?.toLowerCase?.() || '—'}`,
      count: num(s.total), pct: totalMsgs > 0 ? +((num(s.total) / totalMsgs) * 100).toFixed(1) : 0, tone: 'teal' as Tone,
    })),
    scrubbed: checks.length ? checks.map((c: any) => {
      const passR = num(c.total) > 0 ? ((num(c.total) - num(c.failed)) / num(c.total)) * 100 : 100
      return {
        label: `${c.validator} Check`,
        sub: passR >= 95 ? 'passing cleanly' : passR >= 80 ? 'mixed signal' : 'high failure',
        count: num(c.total), pct: Math.round(passR),
        tone: (passR >= 95 ? 'teal' : passR >= 80 ? 'amber' : 'coral') as Tone,
      }
    }) : [],
    failed: reasons.map((r: any) => ({
      label: `${r.dlr_code} · ${r.description}`,
      sub: r.validator || r.validation_step || '—',
      count: num(r.cnt), pct: num(r.pct),
      tone: (num(r.pct) > 40 ? 'coral' : num(r.pct) > 20 ? 'amber' : 'purple') as Tone,
    })),
  }

  // Check stack for modules panel
  const C = { text: 'hsl(var(--foreground))', muted: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))', card: 'hsl(var(--surface-1))', bg: 'hsl(var(--surface-2))' }

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', fontSize: 13, color: C.text }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: TXT.teal, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>GoFlipo Support · Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Overview</h1>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Scrubbing pipeline · time range controlled from top bar · click a stage to drill</div>
          </div>
          {loading && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>Loading…</span>}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 12, background: 'hsl(var(--coral-bg))', border: '1px solid #fca5a5', color: 'hsl(var(--coral-text))' }}>⚠ {error}</div>
      )}

      {/* ── Plain-English summary panel ── */}
      {apiData && (
        <Panel tone={failedTotal > passedTotal ? 'coral' : 'teal'} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>ℹ</span>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>
              Messages received: <strong>{fmt(totalMsgs)}</strong>.{' '}
              <strong style={{ color: 'hsl(var(--teal-text))' }}>{fmt(passedTotal)}</strong> went through ({passRate}% pass rate) and{' '}
              <strong style={{ color: TXT.coral }}>{fmt(failedTotal)}</strong> were blocked.{' '}
              {topErr.dlr_code && <>Most failures (<strong>{pct(topErr.pct)}</strong>) are <strong>{topErr.dlr_code} · {topErr.description}</strong>
              {topSender.sender_id && <> — mainly from <strong>{topSender.sender_id}</strong></>}.</>}{' '}
              {peakHour.hour && <>Busiest hour was around <strong>{peakHour.hour?.slice(11, 13)}:00</strong>.</>}
            </div>
          </div>
        </Panel>
      )}

      {/* ── Status chips ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 20 }}>
        <StatusChip icon="📥" tone="teal"   label="Messages today"  value={fmt(totalMsgs)}        sub="received in window"    />
        <StatusChip icon="✅" tone="purple" label="Pass rate"        value={passRate + '%'}          sub={`${fmt(passedTotal)} delivered`} />
        <StatusChip icon="🚫" tone="coral"  label="Blocked"          value={fmt(failedTotal)}       sub="rejected by checks"   live />
        <StatusChip icon="🔥" tone="amber"  label="Top reason"       value={topErr.dlr_code || '—'} sub={`${topErr.description || '—'} · ${pct(topErr.pct)}`} />
        <StatusChip icon="⏰" tone="teal"   label="Busy hour"        value={peakHour.hour?.slice(11, 13) ? peakHour.hour.slice(11, 13) + ':00' : '—'} sub={`${fmt(peakHour._total)} msgs`} />
        <StatusChip icon="⚠️" tone="coral"  label="Needs attention"  value={String(alerts.length)} sub="open alerts to review" live />
      </div>

      {/* ── Pipeline flow ── */}
      <SectionLabel tone="teal">Pipeline flow · click to drill</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 0 }}>
        <PipelineCard eyebrow="Submitted" title="Submitted" tone="teal"
          sub={`${fmt(counts.submitted || totalMsgs)} records · 100%`}
          active={drill === 'submitted'} onClick={() => setDrill(drill === 'submitted' ? null : 'submitted')} />
        <PipelineCard eyebrow="GoFlipo · Scrubbed" title="Scrubbed" tone="purple" arrow
          sub={`${fmt(counts.scrubbed)} records · 0% drop`}
          active={drill === 'scrubbed'} onClick={() => setDrill(drill === 'scrubbed' ? null : 'scrubbed')} />
        <PipelineCard eyebrow="GoFlipo · Rejected / Blocked" title="Failed" tone="coral" arrow
          sub={`${fmt(failedTotal)} blocked · ${pct(top.fail_pct)} variance`}
          active={drill === 'failed'} onClick={() => setDrill(drill === 'failed' ? null : 'failed')} />
      </div>

      {/* ── Drill panel ── */}
      {drill && (
        <div style={{ marginBottom: 16, borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <DrillShell
            tone={drill === 'submitted' ? 'teal' : drill === 'scrubbed' ? 'purple' : 'coral'}
            eyebrow={drill === 'submitted' ? 'Submitted · sources' : drill === 'scrubbed' ? 'Scrubbed · check modules' : 'Failed · reasons'}
            title={drill === 'submitted' ? 'Where submissions come from' : drill === 'scrubbed' ? 'What ran on each record' : 'Why submissions were blocked'}
            total={drill === 'submitted' ? totalMsgs : drill === 'scrubbed' ? num(counts.scrubbed) : failedTotal}
            rows={drillRows[drill]}
            onClose={() => setDrill(null)}
          />
        </div>
      )}
      {!drill && <div style={{ marginBottom: 16 }} />}

      {/* ── Ops alerts ── */}
      {alerts.length > 0 && (
        <>
          <SectionLabel tone="coral">What needs attention right now</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(alerts.length, 3)},1fr)`, gap: 12, marginBottom: 16 }}>
            {alerts.map((a, i) => (
              <Panel key={i} tone={a.tone}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <Pill tone={a.tone}>{a.severity}</Pill>
                  <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{a.age}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>{a.detail}</div>
                <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: TXT[a.tone] }}>→ {a.action}</span>
                  <button style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 8px', borderRadius: 5, border: '1px solid hsl(var(--border))', background: 'hsl(var(--surface-2))', cursor: 'pointer', color: C.muted }}>Ack</button>
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}

      {/* ── 24H Throughput ── */}
      <SectionLabel tone="purple">24h throughput · submissions / hour</SectionLabel>
      <Panel tone="purple" style={{ marginBottom: 16 }}>
        <LineChart data={trend} tone="purple" />
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>
          <span>peak · {fmt(peakHour._total)} @ {peakHour.hour?.slice(11, 13) || '—'}:00</span>
          <span>total · {fmt(totalMsgs)} submits</span>
          <span>idle hours · {idleHours}</span>
        </div>
      </Panel>

      {/* ── Scrub coverage ── */}
      <SectionLabel tone="teal">Scrub coverage</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[{ tone: 'teal' as Tone, eyebrow: 'Domestic scrub · IN', d: dom, label: 'domestic traffic' },
          { tone: 'purple' as Tone, eyebrow: 'International scrub', d: intl, label: 'cross-border · roaming + intl' }]
          .map(({ tone, eyebrow, d, label }) => (
            <Panel key={eyebrow} tone={tone} eyebrow={eyebrow}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: TXT[tone], lineHeight: 1 }}>
                  {d.pass_rate ? Math.round(num(d.pass_rate)) : '—'}
                </div>
                <div style={{ fontSize: 12, color: C.muted, paddingBottom: 6 }}>{label}</div>
                <div style={{ marginLeft: 'auto', paddingBottom: 4 }}>
                  <Sparkline data={[]} tone={tone} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid hsl(var(--border))' }}>
                {[['Passed', d.passed, 'teal'], ['Blocked', d.blocked, 'coral'], ['Pass-rate', d.pass_rate ? pct(d.pass_rate, 0) : '—', 'amber']].map(([lbl, val, c]) => (
                  <div key={lbl as string}>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>{lbl as string}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: TXT[c as Tone] }}>{typeof val === 'number' ? fmt(val) : val as string}</div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
      </div>

      {/* ── Key metrics ── */}
      <SectionLabel tone="teal">Key metrics</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Submitted', value: fmt(totalMsgs), sub: 'baseline', tone: 'teal' as Tone },
          { label: 'Scrubbed',  value: fmt(counts.scrubbed), sub: '0% drop', tone: 'purple' as Tone },
          { label: 'Blocked',   value: fmt(failedTotal), sub: `↑ ${pct(top.fail_pct)} variance`, tone: 'coral' as Tone },
          { label: 'Pass rate', value: passRate + '%', sub: `${fmt(passedTotal)} delivered`, tone: 'amber' as Tone },
        ].map(m => (
          <div key={m.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${TXT[m.tone]}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: TXT[m.tone], lineHeight: 1, marginBottom: 8 }}>{m.value}</div>
            <div style={{ fontSize: 11.5, color: C.muted, fontFamily: 'monospace' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Source IPs + Recent trace ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Panel tone="amber" eyebrow="Source IP infrastructure" title="Where traffic originates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(apiData?.sourceIps || []).slice(0, 6).map((s: any, i: number) => (
              <div key={s.originator_ip || i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 50px', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid hsl(var(--border))' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{s.originator_ip || '—'}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmt(s.total)} msgs</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bar val={num(s.pct)} tone="amber" height={5} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: C.muted, width: 44, textAlign: 'right', flexShrink: 0 }}>{fmt(s.total)}</span>
                </div>
                <Pill tone="amber">{pct(s.pct, 0)}</Pill>
              </div>
            ))}
            {!apiData?.sourceIps?.length && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, padding: '16px 0', textAlign: 'center', fontFamily: 'monospace' }}>No IP data</div>}
          </div>
        </Panel>

        <Panel tone="coral" eyebrow="Live trace · last submissions" title="Tail of the pipeline">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tail.slice(0, 6).map((s: any, i: number) => {
              const ok = num(apiData?.failureReasons?.find((r: any) => r.dlr_code === s.dlr_code)?.is_success) === 1 || s.dlr_code === '000'
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 56px', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid hsl(var(--border))', fontSize: 11.5 }}>
                  <span style={{ fontFamily: 'monospace', color: C.muted }}>{ts(s.timestamp)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{s.sender_id}</span>
                      <span style={{ fontFamily: 'monospace', color: C.muted, fontSize: 10.5 }}>· {s.pe_id || '—'}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, fontFamily: 'monospace' }}>
                      {s.validation_step?.replace(/_/g, ' ') || '—'} · {s.description || '—'}
                    </div>
                  </div>
                  <Pill tone={ok ? 'success' : 'danger'}>{s.dlr_code}</Pill>
                </div>
              )
            })}
            {tail.length === 0 && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, padding: '16px 0', textAlign: 'center', fontFamily: 'monospace' }}>No recent submissions</div>}
          </div>
        </Panel>
      </div>

      {/* ── Check modules + Variance breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Panel tone="teal" eyebrow="GoFlipo check modules" title="Check stack">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {checks.map((c: any, i: number) => {
              const passR = num(c.total) > 0 ? ((num(c.total) - num(c.failed)) / num(c.total)) * 100 : 100
              const state = passR >= 95 ? 'ok' : passR >= 80 ? 'warn' : 'fail'
              const icon = state === 'ok' ? '✓' : state === 'warn' ? '⚠' : '✕'
              const iconBg = state === 'ok' ? 'hsl(var(--teal-bg))' : state === 'warn' ? 'hsl(var(--amber-bg))' : 'hsl(var(--coral-bg))'
              const iconColor = state === 'ok' ? 'hsl(var(--teal-text))' : state === 'warn' ? 'hsl(var(--amber-text))' : 'hsl(var(--coral-text))'
              const pillTone: Tone = state === 'ok' ? 'teal' : state === 'warn' ? 'amber' : 'coral'
              return (
                <div key={c.validator || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid hsl(var(--border))', fontSize: 13 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: iconColor, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{c.validator} Check</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted, width: 40, textAlign: 'right' }}>{fmt(c.total)}</span>
                  <Pill tone={pillTone}>{Math.round(passR)}%</Pill>
                </div>
              )
            })}
            {checks.length === 0 && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, padding: '16px 0', textAlign: 'center', fontFamily: 'monospace' }}>No check data</div>}
          </div>
        </Panel>

        <Panel tone="purple" eyebrow="Variance breakdown" title="Where volume is lost">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Submitted → Scrubbed', val: 0, tone: 'teal' as Tone },
              { label: 'Scrubbed → Final Pass', val: num(km.pass_rate), tone: 'purple' as Tone },
              { label: 'Blocked (GoFlipo)', val: num(top.fail_pct), tone: 'amber' as Tone },
              ...reasons.slice(0, 2).map((r: any) => ({ label: r.description || r.dlr_code, val: num(r.pct), tone: 'coral' as Tone })),
            ].map(({ label, val, tone }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                  <span>{label}</span>
                  <span style={{ fontFamily: 'monospace', color: C.muted }}>{pct(val, 0)}</span>
                </div>
                <Bar val={val} tone={tone} height={5} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

    </div>
  )
}
