'use client'
// app/(dashboard)/mis/page.tsx
import React, { useState, useCallback, useRef } from 'react'

// ── Palette ────────────────────────────────────────────────────────────────────
const T = {
  teal:   { bg: 'hsl(var(--teal-bg))',   text: 'hsl(var(--teal-text))',   border: 'hsl(var(--teal-border))'   },
  coral:  { bg: 'hsl(var(--coral-bg))',  text: 'hsl(var(--coral-text))',  border: 'hsl(var(--coral-border))'  },
  amber:  { bg: 'hsl(var(--amber-bg))',  text: 'hsl(var(--amber-text))',  border: 'hsl(var(--amber-border))'  },
  purple: { bg: 'hsl(var(--purple-bg))', text: 'hsl(var(--purple-text))', border: 'hsl(var(--purple-border))' },
}
type Tone = keyof typeof T
const fmt = (n: number | string) => Number(n).toLocaleString('en-IN')

// ── Normalize datetime for ClickHouse ──────────────────────────────────────────
function normDt(dt: string): string {
  if (!dt) return dt
  // Date-only input gives "YYYY-MM-DD" (10 chars)
  if (dt.length === 10) return dt + ' 00:00:00'
  // datetime-local gives "YYYY-MM-DDTHH:MM" (16 chars)
  const s = dt.replace('T', ' ')
  return s.length === 16 ? s + ':00' : s
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, tone = 'teal' }: { label: string; value: string | number; sub?: string; tone?: Tone }) {
  const c = T[tone]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: c.text, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 3, fontFamily: 'monospace' }}>{sub}</div>}
    </div>
  )
}

function Card({ children, tone = 'teal', label, action }: { children: React.ReactNode; tone?: Tone; label?: string; action?: React.ReactNode }) {
  const c = T[tone]
  return (
    <div style={{ background: 'hsl(var(--surface-1))', border: `1px solid ${c.border}`, borderRadius: 14, padding: '16px 18px' }}>
      {(label || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
          {label && <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))' }}>{label}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Input style ────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: 'hsl(var(--input-bg))',
  border: '1.5px solid hsl(var(--input-border))',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: 'hsl(var(--input-text))',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const TRAFFIC_OPTS = [
  { id: 'all',           label: 'All Traffic'   },
  { id: 'domestic',      label: '🏠 Domestic'   },
  { id: 'international', label: '✈️ International' },
]

const QUICK_RANGES = [
  { label: '1H',  hours: 1  },
  { label: '6H',  hours: 6  },
  { label: '24H', hours: 24 },
  { label: '48H', hours: 48 },
  { label: '7D',  days:  7  },
  { label: '30D', days:  30 },
]

const DIM_OPTS = [
  { value: 'sender',     label: 'Sender ID'       },
  { value: 'pe_id',      label: 'PE ID'           },
  { value: 'ip',         label: 'Source IP'       },
  { value: 'error_code', label: 'Error Code'      },
  { value: 'step',       label: 'Validation Step' },
]

const GRAN_OPTS = [
  { value: 'hourly',  label: 'Hourly'  },
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
]

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MIS() {
  // Search / filter state (what user is typing)
  const [searchInput, setSearchInput] = useState('')
  const [dim,         setDim]         = useState('sender')
  const [gran,        setGran]        = useState('daily')
  const [traffic,     setTraffic]     = useState('all')
  const [fromDt,      setFromDt]      = useState('')
  const [toDt,        setToDt]        = useState('')
  const [activeRange, setActiveRange] = useState('24H')

  // Applied state (committed on Apply click)
  const [applied, setApplied] = useState({
    search: '', dim: 'sender', gran: 'daily', traffic: 'all',
    from: '', to: '', hours: 24, days: 0,
  })

  // Data state
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (params: typeof applied) => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ dim: params.dim, gran: params.gran })
      if (params.from && params.to) {
        // Date-only inputs: from = start of day, to = end of day
        p.set('from', params.from.length === 10 ? params.from + ' 00:00:00' : normDt(params.from))
        p.set('to',   params.to.length   === 10 ? params.to   + ' 23:59:59' : normDt(params.to))
      } else if (params.days > 0) {
        p.set('days', String(params.days))
      } else {
        p.set('hours', String(params.hours || 24))
      }
      if (params.traffic !== 'all') p.set('traffic', params.traffic)
      if (params.search)            p.set('search',  params.search)
      const res = await fetch(`/api/mis?${p}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  // ── Apply ──────────────────────────────────────────────────────────────────
  const handleApply = () => {
    // Determine time range from UI state
    let hours = 24, days = 0, from = '', to = ''
    if (fromDt && toDt) {
      from = fromDt; to = toDt
    } else {
      const quick = QUICK_RANGES.find(r => r.label === activeRange)
      if (quick) { hours = (quick as any).hours ?? 0; days = (quick as any).days ?? 0 }
    }
    const next = { search: searchInput, dim, gran, traffic, from, to, hours, days }
    setApplied(next)
    load(next)
  }

  // ── Quick range click ─────────────────────────────────────────────────────
  const applyQuick = (r: typeof QUICK_RANGES[0]) => {
    // Toggle off if already active
    if (activeRange === r.label && !fromDt && !toDt) {
      setActiveRange('')
      return
    }
    setActiveRange(r.label)
    setFromDt(''); setToDt('')
    const next = { ...applied, search: searchInput, dim, gran, traffic, from: '', to: '', hours: (r as any).hours ?? 0, days: (r as any).days ?? 0 }
    setApplied(next); load(next)
  }

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows    = data?.rows ?? []
    const dimLbl  = DIM_OPTS.find(d => d.value === applied.dim)?.label ?? 'Dimension'
    const headers = [dimLbl, 'Date', 'Submitted', 'Passed', 'Blocked', 'Pass%', 'Top Error']
    const body    = rows.map((r: any) => [r.dimension, r.date, r.submitted, r.passed, r.blocked, r.passPct, r.topErr].join(','))
    const blob    = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'mis_report.csv' }).click()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const kpis        = data?.kpis        ?? {}
  const rows        = data?.rows        ?? []
  const errorDist   = data?.errorDist   ?? []
  const senderBlock = data?.senderBlock ?? []
  const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—'

  const dimLabel   = DIM_OPTS.find(d => d.value === applied.dim)?.label ?? 'Dimension'
  const granLabel  = GRAN_OPTS.find(g => g.value === applied.gran)?.label ?? 'Daily'

  // Active filter chips
  const chips = [
    applied.search  && { label: `search: ${applied.search}`,   tone: 'teal'   as Tone },
    applied.traffic !== 'all' && { label: applied.traffic,     tone: 'purple' as Tone },
    (applied.from && applied.to) && { label: `${applied.from.slice(5,16)} → ${applied.to.slice(5,16)}`, tone: 'amber' as Tone },
  ].filter(Boolean) as { label: string; tone: Tone }[]

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 11px', fontSize: 12, borderRadius: 7, border: 'none', cursor: 'pointer',
    fontFamily: 'monospace', fontWeight: active ? 700 : 400, transition: 'all 0.15s',
    background: active ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
    color:      active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
  })

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'hsl(var(--primary))'
    e.currentTarget.style.boxShadow   = '0 0 0 3px hsl(var(--primary) / 0.15)'
  }
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'hsl(var(--input-border))'
    e.currentTarget.style.boxShadow   = 'none'
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'hsl(var(--teal-text))', marginBottom: 5 }}>
          GoFlipo · Reporting
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'hsl(var(--foreground))', margin: 0 }}>MIS Reports</h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
          Search and filter submissions by sender, PE ID, error code, or IP — across any date range.
        </p>
      </div>

      {/* ── Search & Filter panel ────────────────────────────────────────── */}
      <Card tone="teal" label="Search · filters · date range">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row 1: Main search + Group by + Granularity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px', gap: 10 }}>
            {/* Universal search */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                Search · sender / PE ID / source IP / authcode / error
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none', fontSize: 14 }}>🔍</div>
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApply()}
                  placeholder="e.g. Parimatch · 2026012016513482330 · 0.0.0.0 · 907"
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>
            </div>

            {/* Group by dimension */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                Group by
              </label>
              <select value={dim} onChange={e => setDim(e.target.value)} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}>
                {DIM_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Granularity */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                Granularity
              </label>
              <select value={gran} onChange={e => setGran(e.target.value)} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}>
                {GRAN_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Quick ranges + Custom date + Traffic */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>

            {/* Quick time ranges */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
                Quick range
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {QUICK_RANGES.map(r => (
                  <button key={r.label} onClick={() => applyQuick(r)} style={btnStyle(activeRange === r.label && !fromDt && !toDt)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 36, background: 'hsl(var(--border))', flexShrink: 0 }} />

            {/* Custom from */}
            <div style={{ minWidth: 170 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                From
              </label>
              <input
                type="date"
                value={fromDt}
                onChange={e => { setFromDt(e.target.value); setActiveRange('') }}
                style={{ ...inputStyle, fontSize: 12 }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            {/* Custom to */}
            <div style={{ minWidth: 170 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                To
              </label>
              <input
                type="date"
                value={toDt}
                onChange={e => { setToDt(e.target.value); setActiveRange('') }}
                style={{ ...inputStyle, fontSize: 12 }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 36, background: 'hsl(var(--border))', flexShrink: 0 }} />

            {/* Traffic */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
                Traffic
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {TRAFFIC_OPTS.map(o => (
                  <button key={o.id} onClick={() => setTraffic(o.id)} style={btnStyle(traffic === o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Apply button */}
            <button onClick={handleApply}
              style={{ padding: '9px 28px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', transition: 'opacity 0.15s', flexShrink: 0 }}>
              Apply →
            </button>
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid hsl(var(--border))' }}>
              {chips.map(ch => {
                const c = T[ch.tone]
                return (
                  <span key={ch.label} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontFamily: 'monospace', fontSize: 11, padding: '2px 10px', borderRadius: 99 }}>
                    {ch.label}
                  </span>
                )
              })}
              <button onClick={() => {
                setSearchInput(''); setFromDt(''); setToDt(''); setTraffic('all'); setActiveRange('24H')
                const reset = { search: '', dim, gran, traffic: 'all', from: '', to: '', hours: 24, days: 0 }
                setApplied(reset); load(reset)
              }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'hsl(var(--muted-foreground))', padding: '2px 8px', fontFamily: 'monospace' }}>
                ✕ clear
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: T.coral.bg, border: `1px solid ${T.coral.border}`, borderRadius: 10, padding: 14, color: T.coral.text, fontFamily: 'monospace', fontSize: 12, marginTop: 14 }}>
          ⚠ {error}
        </div>
      )}
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
          Set your filters above and click <strong>Apply →</strong> to generate the report.
        </div>
      )}
      {loading && (
        <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', marginTop: 16 }}>
          Loading report…
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── KPI strip ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16, marginBottom: 16 }}>
            <Kpi label="Messages"   tone="teal"   value={fmt(kpis.messages ?? kpis.totalSubmitted ?? 0)} sub={`${fmt(kpis.segments ?? 0)} segments`} />
            <Kpi label="Passed"     tone="purple" value={fmt(kpis.totalPassed ?? 0)} sub={pct(kpis.totalPassed ?? 0, kpis.segments ?? kpis.totalSubmitted ?? 0)} />
            <Kpi label="Blocked"    tone="coral"  value={fmt(kpis.totalBlocked ?? 0)} sub={pct(kpis.totalBlocked ?? 0, kpis.segments ?? kpis.totalSubmitted ?? 0)} />
            <Kpi label="Senders"    tone="amber"  value={fmt(kpis.distinctSenders ?? 0)} />
            <Kpi label="Top error"  tone="coral"  value={kpis.topError ?? '—'} />
          </div>

          {/* ── Table + Error dist ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
            <Card tone="coral" label={`${dimLabel} × ${granLabel}${applied.search ? ` · "${applied.search}"` : ''}`}
              action={
                <button onClick={exportCSV}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: 'hsl(var(--accent))', border: '1px solid hsl(var(--border))', borderRadius: 7, fontSize: 11.5, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }}>
                  ↓ Export CSV
                </button>
              }>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[dimLabel, 'Date', 'Submitted', 'Passed', 'Blocked', 'Pass %', 'Top Error'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))', paddingBottom: 10, paddingRight: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={7} style={{ fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', padding: '20px 0', fontSize: 12 }}>
                        No data for the current filters
                      </td></tr>
                    )}
                    {rows.slice(0, 200).map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid hsl(var(--border))' }}>
                        <td style={{ padding: '8px 14px 8px 0', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.dimension}>{r.dimension}</td>
                        <td style={{ padding: '8px 14px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{r.date}</td>
                        <td style={{ padding: '8px 14px 8px 0', fontFamily: 'monospace' }}>{fmt(r.submitted)}</td>
                        <td style={{ padding: '8px 14px 8px 0', fontFamily: 'monospace', color: T.purple.text }}>{fmt(r.passed)}</td>
                        <td style={{ padding: '8px 14px 8px 0', fontFamily: 'monospace', color: T.coral.text }}>{fmt(r.blocked)}</td>
                        <td style={{ padding: '8px 14px 8px 0', fontFamily: 'monospace', color: r.passPct < 5 ? T.coral.text : T.purple.text, fontWeight: r.passPct < 5 ? 700 : 400 }}>
                          {Number(r.passPct).toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px 14px 8px 0' }}>
                          <span style={{ background: T.coral.bg, color: T.coral.text, fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>{r.topErr}</span>
                        </td>
                      </tr>
                    ))}
                    {/* Totals */}
                    {rows.length > 0 && (
                      <tr style={{ borderTop: '2px solid hsl(var(--border))', fontWeight: 700, background: 'hsl(var(--accent))' }}>
                        <td colSpan={2} style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase' }}>
                          Totals ({rows.length} rows)
                        </td>
                        <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace' }}>{fmt(kpis.totalSubmitted)}</td>
                        <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace', color: T.purple.text }}>{fmt(kpis.totalPassed)}</td>
                        <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace', color: T.coral.text }}>{fmt(kpis.totalBlocked)}</td>
                        <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace' }}>{pct(kpis.totalPassed ?? 0, kpis.totalSubmitted ?? 0)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card tone="purple" label="Error code distribution">
              {errorDist.length === 0 && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>No errors in range</div>}
              {errorDist.map((e: any) => {
                const c = T[e.tone as Tone] ?? T.coral
                return (
                  <div key={e.code} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))', marginRight: 6 }}>{e.code}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(e.count)}</span>
                      </span>
                      <span style={{ fontFamily: 'monospace' }}>{e.pct}%</span>
                    </div>
                    <div style={{ background: 'hsl(var(--muted))', borderRadius: 999, overflow: 'hidden', height: 4 }}>
                      <div style={{ height: '100%', width: `${e.pct}%`, background: c.text, borderRadius: 999, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>

          {/* ── Sender block rate ──────────────────────────────────────────── */}
          {senderBlock.length > 0 && (
            <Card tone="amber" label="Sender block rate">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                {senderBlock.map((s: any) => (
                  <div key={s.sender} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 120, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.sender}>{s.sender}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: 'hsl(var(--muted))', borderRadius: 999, overflow: 'hidden', height: 4 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, s.blockPct)}%`, background: T.coral.text, borderRadius: 999 }} />
                      </div>
                    </div>
                    <span style={{ width: 56, textAlign: 'right', fontFamily: 'monospace', fontSize: 11.5 }}>{fmt(s.total)}</span>
                    <span style={{ width: 44, textAlign: 'right', fontFamily: 'monospace', fontSize: 11.5, color: T.coral.text }}>{s.blockPct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
