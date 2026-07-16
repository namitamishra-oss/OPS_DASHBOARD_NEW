'use client'
// app/(dashboard)/trace/page.tsx  — Trace + Scrubbing unified
import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useDashboardControls } from '@/components/Topbar'

// ── Inline icons ──────────────────────────────────────────────────────────────
const IC = {
  Search: () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/></svg>,
  DL:     () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>,
  Prev:   () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Next:   () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  X:      () => <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>,
}

// ── Palette ───────────────────────────────────────────────────────────────────
// CSS variable–based palette — adapts to light/dark theme automatically
const T = {
  teal:   { bg: 'hsl(var(--teal-bg))',   text: 'hsl(var(--teal-text))',   border: 'hsl(var(--teal-border))'   },
  coral:  { bg: 'hsl(var(--coral-bg))',  text: 'hsl(var(--coral-text))',  border: 'hsl(var(--coral-border))'  },
  amber:  { bg: 'hsl(var(--amber-bg))',  text: 'hsl(var(--amber-text))',  border: 'hsl(var(--amber-border))'  },
  purple: { bg: 'hsl(var(--purple-bg))', text: 'hsl(var(--purple-text))', border: 'hsl(var(--purple-border))' },
} as const
type Tone = keyof typeof T
const TONES: Tone[] = ['coral','amber','purple','teal','coral','amber','purple','teal']

const fmt = (n: number | string) => Number(n).toLocaleString('en-IN')

// Normalize date "YYYY-MM-DD" → "YYYY-MM-DD HH:MM:SS" for ClickHouse
function normDate(d: string, end = false) {
  if (!d) return ''
  return d + (end ? ' 23:59:59' : ' 00:00:00')
}

// ── Reusable components ───────────────────────────────────────────────────────
function Kpi({ label, value, sub, tone = 'teal' }: { label: string; value: string | number; sub?: string; tone?: Tone }) {
  const c = T[tone]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px', minWidth: 0 }}>
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

function Bar({ pct, tone = 'teal' }: { pct: number; tone?: Tone }) {
  const c = T[tone]
  return (
    <div style={{ background: 'hsl(var(--muted))', borderRadius: 999, overflow: 'hidden', height: 4 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: c.text, borderRadius: 999, transition: 'width 0.4s' }} />
    </div>
  )
}

function Chip({ children, active, tone = 'coral', onClick }: { children: React.ReactNode; active?: boolean; tone?: Tone; onClick?: () => void }) {
  const c = T[tone]
  return (
    <button onClick={onClick} style={{
      padding: '3px 11px', borderRadius: 99, fontSize: 11.5, fontFamily: 'monospace',
      border: `1px solid ${active ? c.text : c.border}`,
      background: active ? c.text : c.bg,
      color: active ? '#000' : c.text,
      cursor: onClick ? 'pointer' : 'default', fontWeight: active ? 700 : 400, transition: 'all 0.15s',
    }}>{children}</button>
  )
}

// ── Search input style (light, readable) ──────────────────────────────────────
// CSS variable–based inputs — theme-aware
const searchInput = (): React.CSSProperties => ({
  background:   'hsl(var(--input-bg))',
  border:       '1.5px solid hsl(var(--input-border))',
  borderRadius: 8,
  padding: '9px 12px 9px 36px',
  fontSize: 13,
  fontFamily: 'inherit',
  color:        'hsl(var(--input-text))',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
})

const smInput = (): React.CSSProperties => ({
  background:   'hsl(var(--input-bg))',
  border:       '1.5px solid hsl(var(--input-border))',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12.5,
  fontFamily: 'monospace',
  color:        'hsl(var(--input-text))',
  outline: 'none',
  width: '100%',
})

type Tab = 'trace' | 'scrubbing'

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TraceScrubbing() {
  const { toApiParams, refreshTick } = useDashboardControls()

  // ── Read URL params BEFORE state init so first load fires with them ─────────
  const searchParams = useSearchParams()
  const _urlSearch  = searchParams?.get('search')  || ''
  const _urlSender  = searchParams?.get('sender')  || ''
  const _urlTraffic = searchParams?.get('traffic') || 'all'
  const _urlTab     = (searchParams?.get('tab') as Tab) || 'trace'

  // ── State ─────────────────────────────────────────────────────────────────
  const [tab,         setTab]         = useState<Tab>(_urlTab)
  const [traffic,     setTraffic]     = useState(_urlTraffic)
  const [activeStep,  setActiveStep]  = useState('')

  // Search fields — pre-filled from URL
  const [searchInput2, setSearchInput2] = useState(_urlSearch)
  const [authInput,    setAuthInput]    = useState('')
  const [senderInput,  setSenderInput]  = useState(_urlSender)
  const [codeFilter,   setCodeFilter]   = useState('')

  // Applied (committed) search state — also pre-filled from URL
  const [appliedSearch,  setAppliedSearch]  = useState(_urlSearch)
  const [appliedAuth,    setAppliedAuth]    = useState('')
  const [appliedSender,  setAppliedSender]  = useState(_urlSender)

  const [page,    setPage]    = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Local date range (overrides Topbar when set) ──────────────────────────
  const [fromDate,    setFromDate]    = useState('')
  const [toDate,      setToDate]      = useState('')
  const [activeQuick, setActiveQuick] = useState('')
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const endpoint = tab === 'trace' ? '/api/trace' : '/api/scrubbing'
      // Read toApiParams() fresh on every load call — ensures time range is current
      const api = toApiParams()
      const p   = new URLSearchParams()
      // Local date range overrides Topbar when set
      if (fromDate && toDate) {
        p.set('from', normDate(fromDate, false))
        p.set('to',   normDate(toDate,   true))
      } else if (api.from && api.to)   { p.set('from', api.from); p.set('to', api.to) }
      else if (api.days)                p.set('days',  String(api.days))
      else                              p.set('hours', String(api.hours ?? 24))
      if (traffic !== 'all')            p.set('traffic', traffic)
      if (appliedSearch)                p.set('search',   appliedSearch)
      if (appliedAuth)                  p.set('authcode', appliedAuth)
      if (appliedSender)                p.set('sender',   appliedSender)
      if (codeFilter)                   p.set('code',     codeFilter)
      if (activeStep && tab === 'scrubbing') p.set('step', activeStep)
      if (tab === 'trace')            { p.set('page', String(page)); p.set('limit', '50') }
      const res = await fetch(`${endpoint}?${p}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab, page, toApiParams, refreshTick, traffic, appliedSearch, appliedAuth, appliedSender, codeFilter, activeStep, fromDate, toDate])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [tab, traffic, codeFilter, activeStep, appliedSearch, appliedAuth, appliedSender, fromDate, toDate])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(searchInput2)
    setAppliedAuth(authInput)
    setAppliedSender(senderInput)
    setPage(1)
  }

  const clearAll = () => {
    setSearchInput2(''); setAuthInput(''); setSenderInput('')
    setAppliedSearch(''); setAppliedAuth(''); setAppliedSender('')
    setCodeFilter(''); setActiveStep(''); setFromDate(''); setToDate(''); setActiveQuick(''); setPage(1)
  }

  const hasFilters = appliedSearch || appliedAuth || appliedSender || codeFilter || activeStep || traffic !== 'all' || fromDate || toDate

  const exportCSV = () => {
    const tableRows = tab === 'trace' ? (data?.rows ?? []) : (data?.log ?? [])
    const headers   = tab === 'trace'
      ? ['time','authcode','sender','pe_id','recipient','step','code','status','ip','error_message']
      : ['time','authcode','sender','pe_id','recipient','step','code','ip','error_message']
    const body = tableRows.map((r: any) =>
      tab === 'trace'
        ? [r.ts, r.authcode, r.sender, r.peId, r.recipient, r.step, r.code, r.status === 1 ? 'passed' : 'blocked', r.ip, r.errMsg].join(',')
        : [r.ts, r.authcode, r.sender, r.peId, r.recipient, r.step, r.code, r.ip, r.errMsg].join(',')
    )
    const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${tab}_export.csv` }).click()
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const kpis      = data?.kpis   ?? {}
  const codes     = data?.codes  ?? []
  const senders   = data?.senders ?? []
  const rows      = data?.rows   ?? []
  const log       = data?.log    ?? []
  const steps     = data?.steps  ?? []
  const ips       = data?.ips    ?? []
  const pag       = data?.pagination ?? {}
  const tableRows = tab === 'trace' ? rows : log
  const maxStep   = Math.max(...steps.map((s: any) => Number(s.count)), 1)

  const QUICK = [
    { label: '1H',  hours: 1  },
    { label: '6H',  hours: 6  },
    { label: '24H', hours: 24 },
    { label: '48H', hours: 48 },
    { label: '7D',  days:  7  },
    { label: '30D', days:  30 },
  ]
  const applyQuick = (q: typeof QUICK[0]) => {
    // Toggle off
    if (activeQuick === q.label) { setActiveQuick(''); setFromDate(''); setToDate(''); setPage(1); return }
    setActiveQuick(q.label)
    // Convert quick range to absolute date strings so load() uses local override
    const now  = new Date()
    const end  = new Date(now)
    const start = new Date(now)
    if ((q as any).hours) start.setHours(start.getHours() - (q as any).hours)
    else if ((q as any).days) start.setDate(start.getDate() - (q as any).days)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)  // YYYY-MM-DD
    setFromDate(fmt(start))
    setToDate(fmt(end))
    setPage(1)
  }

  // ── Traffic toggle ─────────────────────────────────────────────────────────
  const trafficOpts = [
    { id: 'all', label: 'All Traffic' },
    { id: 'domestic', label: '🏠 Domestic' },
    { id: 'international', label: '✈️ International' },
  ]

  // ── Tab button style ───────────────────────────────────────────────────────
  const tabBtn = (t: Tab): React.CSSProperties => ({
    padding: '6px 20px', fontSize: 12, fontWeight: tab === t ? 700 : 500,
    background: tab === t ? '#20B2AA' : 'transparent',
    color: tab === t ? '#000' : 'var(--muted-foreground,#94a3b8)',
    border: 'none', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.06em',
  })

  const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—'

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#20B2AA', marginBottom: 5 }}>
          GoFlipo · Log Explorer
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'hsl(var(--foreground))', margin: 0 }}>
            Trace &amp; Scrubbing
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 3, background: 'hsl(var(--muted))', padding: 3, borderRadius: 9 }}>
              <button style={tabBtn('trace')}    onClick={() => setTab('trace')}>TRACE LOG</button>
              <button style={tabBtn('scrubbing')} onClick={() => setTab('scrubbing')}>SCRUBBING</button>
            </div>
            {/* Traffic toggle */}
            <div style={{ display: 'flex', gap: 3, background: 'hsl(var(--muted))', padding: 3, borderRadius: 9 }}>
              {trafficOpts.map(o => (
                <button key={o.id} onClick={() => setTraffic(o.id)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: traffic === o.id ? '#20B2AA' : 'transparent',
                    color: traffic === o.id ? '#000' : 'var(--muted-foreground,#94a3b8)',
                    fontWeight: traffic === o.id ? 700 : 400, transition: 'all 0.15s' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <Card tone="teal" label="Search &amp; Filter · sender · PE ID · mobile · authcode · IP · error message">
        <form onSubmit={submitSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {/* Universal search */}
            <div style={{ position: 'relative', gridColumn: '1 / -1' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}>
                <IC.Search />
              </div>
              <input
                value={searchInput2}
                onChange={e => setSearchInput2(e.target.value)}
                placeholder="Search by sender ID, PE ID, mobile number, IP address, or error message…"
                style={searchInput()}
                onFocus={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.15)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'hsl(var(--input-border))'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Authcode */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                Authcode (exact / partial)
              </label>
              <input
                value={authInput}
                onChange={e => setAuthInput(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4…"
                style={smInput()}
                onFocus={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.15)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'hsl(var(--input-border))'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Sender */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                Sender ID
              </label>
              <select
                value={senderInput}
                onChange={e => setSenderInput(e.target.value)}
                style={smInput()}
              >
                <option value="">All senders</option>
                {senders.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Error code */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                Error Code
              </label>
              <select
                value={codeFilter}
                onChange={e => setCodeFilter(e.target.value)}
                style={smInput()}
              >
                <option value="">All codes</option>
                {codes.map((c: any) => <option key={c.code} value={c.code}>{c.code} — {c.pct}%</option>)}
              </select>
            </div>
          </div>

          {/* ── Date Range row ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 4, paddingBottom: 2 }}>

            {/* Quick ranges */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>Quick range</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {QUICK.map(q => (
                  <button key={q.label} type="button" onClick={() => applyQuick(q)}
                    style={{ padding: '5px 10px', fontSize: 11.5, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: activeQuick === q.label ? 700 : 400,
                      background: activeQuick === q.label ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
                      color:      activeQuick === q.label ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      transition: 'all 0.15s' }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: 1, height: 36, background: 'hsl(var(--border))', flexShrink: 0 }} />

            {/* From date */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>From</label>
              <input type="date" value={fromDate}
                onChange={e => { setFromDate(e.target.value); setActiveQuick('') }}
                style={{ ...smInput(), minWidth: 150, colorScheme: 'dark' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))' }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'hsl(var(--input-border))' }}
              />
            </div>

            {/* To date */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>To</label>
              <input type="date" value={toDate}
                onChange={e => { setToDate(e.target.value); setActiveQuick('') }}
                style={{ ...smInput(), minWidth: 150, colorScheme: 'dark' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))' }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'hsl(var(--input-border))' }}
              />
            </div>

            {/* Clear dates */}
            {(fromDate || toDate) && (
              <button type="button"
                onClick={() => { setFromDate(''); setToDate(''); setActiveQuick('') }}
                style={{ padding: '7px 12px', fontSize: 11.5, background: 'hsl(var(--accent))', border: '1px solid hsl(var(--border))', borderRadius: 7, cursor: 'pointer', color: 'hsl(var(--muted-foreground))', alignSelf: 'flex-end' }}>
                ✕ Clear dates
              </button>
            )}

            {/* Date range chip */}
            {fromDate && toDate && (
              <div style={{ alignSelf: 'flex-end', padding: '5px 12px', background: 'hsl(var(--amber-bg))', border: '1px solid hsl(var(--amber-border))', borderRadius: 99, fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--amber-text))' }}>
                📅 {fromDate.slice(5)} → {toDate.slice(5)}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#20B2AA', color: 'hsl(var(--foreground))', border: 'none', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}>
              <IC.Search /> Search
            </button>
            {hasFilters && (
              <button type="button" onClick={clearAll}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'hsl(var(--accent))', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12, color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }}>
                <IC.X /> Clear all
              </button>
            )}
          </div>
        </form>

        {/* Active filter chips */}
        {hasFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid hsl(var(--border))' }}>
            {appliedSearch  && <Chip tone="teal">search: {appliedSearch}</Chip>}
            {appliedAuth    && <Chip tone="purple">authcode: {appliedAuth}</Chip>}
            {appliedSender  && <Chip tone="amber">sender: {appliedSender}</Chip>}
            {codeFilter     && <Chip tone="coral">code: {codeFilter}</Chip>}
            {activeStep     && <Chip tone="coral">step: {activeStep}</Chip>}
            {traffic !== 'all' && <Chip tone="teal">{traffic}</Chip>}
            {(fromDate || activeQuick) && <Chip tone="amber">{activeQuick || `${fromDate} → ${toDate}`}</Chip>}
            {fromDate && toDate && <Chip tone="amber">📅 {fromDate.slice(5)} → {toDate.slice(5)}</Chip>}
          </div>
        )}
      </Card>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: T.coral.bg, border: `1px solid ${T.coral.border}`, borderRadius: 10, padding: 14, color: T.coral.text, fontFamily: 'monospace', fontSize: 12, marginTop: 14 }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', marginTop: 16 }}>
          Loading…
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── KPI strip ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginTop: 16, marginBottom: 16 }}>
            {tab === 'trace' ? (
              <>
                <Kpi label="Messages"         tone="teal"   value={fmt(kpis.messages ?? pag.total ?? 0)} sub={`${fmt(kpis.segments ?? 0)} segments`} />
                <Kpi label="Passed segments"  tone="purple" value={fmt(kpis.passed ?? 0)}  sub={pct(kpis.passed ?? 0, kpis.segments ?? kpis.total ?? 0)} />
                <Kpi label="Blocked segments" tone="coral"  value={fmt(kpis.blocked ?? 0)} sub={pct(kpis.blocked ?? 0, kpis.segments ?? kpis.total ?? 0)} />
                <Kpi label="Distinct senders" tone="amber"  value={fmt(kpis.distinctSenders ?? 0)} />
              </>
            ) : (
              <>
                <Kpi label="Messages"    tone="teal"   value={fmt(kpis.messages ?? kpis.totalSubmitted ?? 0)} sub={`${fmt(kpis.segments ?? 0)} segments`} />
                <Kpi label="Passed"      tone="purple" value={fmt(kpis.totalPassed  ?? 0)} sub={pct(kpis.totalPassed ?? 0, kpis.segments ?? kpis.totalSubmitted ?? 0)} />
                <Kpi label="Blocked"     tone="coral"  value={fmt(kpis.totalBlocked ?? 0)} sub={pct(kpis.totalBlocked ?? 0, kpis.segments ?? kpis.totalSubmitted ?? 0)} />
                <Kpi label="Worst step"  tone="amber"  value={kpis.worstStep ?? '—'} />
                <Kpi label="Top error"   tone="coral"  value={kpis.topError  ?? '—'} />
              </>
            )}
          </div>

          {/* ── SCRUBBING: Step breakdown + Codes ─────────────────── */}
          {tab === 'scrubbing' && steps.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, marginBottom: 16 }}>
              <Card tone="coral" label="Blocks by validation step · click to filter">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => setActiveStep('')}
                    style={{ all: 'unset', cursor: 'pointer', padding: '5px 8px', borderRadius: 7, fontSize: 12.5,
                      background: !activeStep ? T.teal.bg : 'transparent',
                      color: !activeStep ? T.teal.text : 'var(--muted-foreground,#94a3b8)',
                      fontWeight: !activeStep ? 700 : 400 }}>
                    All steps
                  </button>
                  {steps.map((s: any) => {
                    const on = activeStep === s.step
                    const tc = T[s.tone as Tone] ?? T.coral
                    return (
                      <button key={s.step} onClick={() => setActiveStep(on ? '' : s.step)}
                        style={{ all: 'unset', cursor: 'pointer', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5, fontWeight: on ? 700 : 400, color: on ? tc.text : 'inherit' }}>
                          <span style={{ textTransform: 'capitalize' }}>{s.label ?? s.step}</span>
                          <span style={{ fontFamily: 'monospace' }}>{fmt(s.count)}</span>
                        </div>
                        <Bar pct={s.pct} tone={s.tone ?? 'coral'} />
                      </button>
                    )
                  })}
                </div>
              </Card>

              <Card tone="purple" label={activeStep ? `Codes · ${activeStep}` : 'Error codes · all steps'}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {codes.map((c: any) => {
                    const tc = T[c.tone as Tone] ?? T.coral
                    return (
                      <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid hsl(var(--border))' }}>
                        <span style={{ background: tc.bg, color: tc.text, fontFamily: 'monospace', fontSize: 11.5, padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>{c.code}</span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{fmt(c.count)}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>{c.pct}%</span>
                      </div>
                    )
                  })}
                </div>
                {ips.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid hsl(var(--border))' }}>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>Top source IPs</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {ips.map((ip: any) => (
                        <div key={ip.ip} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontFamily: 'monospace' }}>
                          <span>{ip.ip}</span>
                          <span style={{ color: '#F5A623' }}>{ip.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Log table ─────────────────────────────────────────── */}
          <Card
            tone="teal"
            label={tab === 'trace' ? `Trace log · ${fmt(pag.total ?? 0)} rows` : `Block audit · ${fmt(tableRows.length)} rows${activeStep ? ` · ${activeStep}` : ''}`}
            action={
              <button onClick={exportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: 'hsl(var(--accent))', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7, fontSize: 11.5, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <IC.DL /> Export CSV
              </button>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {['', 'Time', 'Authcode', 'Sender', 'PE ID', 'Mobile', 'Step', 'Code', ...(tab === 'trace' ? ['Status'] : []), 'Source IP', 'Error Message'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))', paddingBottom: 10, paddingRight: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 && (
                    <tr><td colSpan={11} style={{ fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', padding: '24px 0', fontSize: 12 }}>
                      No records match the current filters
                    </td></tr>
                  )}
                  {tableRows.map((r: any) => {
                    const passed   = r.status === 1
                    const ct       = passed ? T.teal : T.coral
                    const isOpen   = expanded === r.uuid
                    const colSpan  = tab === 'trace' ? 11 : 10

                    // Parse error message JSON if possible
                    let errParsed: Record<string, string> | null = null
                    try { if (r.errMsg && r.errMsg.startsWith('{')) errParsed = JSON.parse(r.errMsg) } catch {}

                    return (
                      <React.Fragment key={r.uuid}>
                        {/* ── Main row ── */}
                        <tr
                          onClick={() => setExpanded(isOpen ? null : r.uuid)}
                          title={`${r.totalSegments && r.totalSegments > 1 ? `Multipart SMS · segment ${r.segmentSeq ?? 1} of ${r.totalSegments}` : 'Single-segment SMS'} · click to view full details`}
                          style={{ borderTop: '1px solid hsl(var(--border))', cursor: 'pointer', transition: 'background 0.12s',
                            background: isOpen ? 'hsl(var(--accent))' : 'transparent' }}
                          onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--accent) / 0.5)' }}
                          onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          {/* Expand indicator */}
                          <td style={{ padding: '7px 6px 7px 0', width: 20, color: 'hsl(var(--muted-foreground))' }}>
                            <span style={{ fontSize: 10, display: 'inline-block', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                          </td>
                          <td style={{ padding: '7px 14px 7px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                            {String(r.ts ?? '').slice(5, 19)}
                          </td>
                          <td style={{ padding: '7px 14px 7px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span title={r.authcode}>{r.authcode ? r.authcode.slice(0, 18) + '…' : '—'}</span>
                            {r.totalSegments > 1 && (
                              <span title={`Multipart · ${r.totalSegments} segments`}
                                style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: T.purple.bg, color: T.purple.text, verticalAlign: 'middle' }}>
                                {r.totalSegments}×
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '7px 14px 7px 0', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.sender}</td>
                          <td style={{ padding: '7px 14px 7px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.peId}
                          </td>
                          <td style={{ padding: '7px 14px 7px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                            {r.recipient ? String(r.recipient).slice(-10) : '—'}
                          </td>
                          <td style={{ padding: '7px 14px 7px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{r.step || '—'}</td>
                          <td style={{ padding: '7px 14px 7px 0' }}>
                            {r.code ? <span style={{ background: ct.bg, color: ct.text, fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 5 }}>{r.code}</span> : '—'}
                          </td>
                          {tab === 'trace' && (
                            <td style={{ padding: '7px 14px 7px 0' }}>
                              <span style={{ background: passed ? T.teal.bg : T.coral.bg, color: passed ? T.teal.text : T.coral.text, fontFamily: 'monospace', fontSize: 10.5, padding: '2px 8px', borderRadius: 5 }}>
                                {passed ? 'passed' : 'blocked'}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: '7px 14px 7px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{r.ip || '—'}</td>
                          <td style={{ padding: '7px 14px 7px 0', fontSize: 11, color: 'hsl(var(--muted-foreground))', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {errParsed ? `${errParsed.reason ?? errParsed.message ?? errParsed.step ?? '—'}` : (r.errMsg || '—')}
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isOpen && (
                          <tr style={{ background: 'hsl(var(--accent))', borderTop: 'none' }}>
                            <td colSpan={colSpan} style={{ padding: '0 0 0 26px' }}>
                              <div style={{
                                margin: '0 0 12px 0',
                                background: 'hsl(var(--surface-1))',
                                border: `1px solid hsl(var(--teal-border))`,
                                borderRadius: 10,
                                padding: '14px 18px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '10px 24px',
                              }}>
                                {/* All fields full-width */}
                                {[
                                  { label: 'Timestamp',     value: String(r.ts ?? '—') },
                                  { label: 'Authcode',      value: r.authcode || '—',    mono: true },
                                  { label: 'Sender ID',     value: r.sender   || '—' },
                                  { label: 'PE ID',         value: r.peId     || '—',    mono: true },
                                  { label: 'Mobile Number', value: r.recipient || '—',   mono: true },
                                  { label: 'Source IP',     value: r.ip       || '—',    mono: true },
                                  { label: 'Validation Step', value: r.step   || '—' },
                                  { label: 'DLR Code',      value: r.code ? String(r.code) : '—', mono: true },
                                  { label: 'Total Segments', value: r.totalSegments ? `${r.totalSegments} segment${r.totalSegments > 1 ? 's' : ''}${r.totalSegments > 1 ? ' (multipart SMS)' : ''}` : '1 segment', mono: true },
                                  { label: 'Segment Number', value: r.segmentSeq ? `${r.segmentSeq} of ${r.totalSegments ?? 1}` : '—', mono: true },
                                  ...(tab === 'trace' ? [{ label: 'Status', value: passed ? 'Passed ✓' : 'Blocked ✕' }] : []),
                                ].map(f => (
                                  <div key={f.label}>
                                    <div style={{ fontSize: 9.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'hsl(var(--muted-foreground))', marginBottom: 3 }}>
                                      {f.label}
                                    </div>
                                    <div style={{ fontSize: 12.5, fontFamily: f.mono ? 'monospace' : 'inherit', wordBreak: 'break-all', color: 'hsl(var(--foreground))' }}>
                                      {f.value}
                                    </div>
                                  </div>
                                ))}

                                {/* Error message — full width */}
                                {r.errMsg && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: 9.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
                                      Error Message (raw)
                                    </div>
                                    {errParsed ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {Object.entries(errParsed).map(([k, v]) => (
                                          <div key={k} style={{ background: 'hsl(var(--coral-bg))', border: `1px solid hsl(var(--coral-border))`, borderRadius: 7, padding: '5px 10px' }}>
                                            <span style={{ fontSize: 10, color: 'hsl(var(--coral-text))', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 2 }}>{k}</span>
                                            <span style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace' }}>{String(v)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', background: 'hsl(var(--muted))', borderRadius: 7, padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'hsl(var(--foreground))' }}>
                                        {r.errMsg}
                                      </pre>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {tab === 'trace' && pag.pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid hsl(var(--border))' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  Page {page} of {pag.pages} · {fmt(pag.total)} total
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'hsl(var(--accent))', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.35 : 1, color: 'hsl(var(--foreground))' }}>
                    <IC.Prev />
                  </button>
                  {/* Page number chips */}
                  {Array.from({ length: Math.min(5, pag.pages) }, (_, i) => {
                    const p = Math.max(1, Math.min(pag.pages - 4, page - 2)) + i
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        style={{ width: 32, height: 32, background: p === page ? '#20B2AA' : 'hsl(var(--accent))', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: p === page ? 700 : 400, color: p === page ? '#000' : 'var(--muted-foreground,#94a3b8)' }}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(pag.pages, p + 1))} disabled={page >= pag.pages}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'hsl(var(--accent))', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 7, cursor: page >= pag.pages ? 'not-allowed' : 'pointer', opacity: page >= pag.pages ? 0.35 : 1, color: 'hsl(var(--foreground))' }}>
                    <IC.Next />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
