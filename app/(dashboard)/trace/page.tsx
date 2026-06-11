'use client'
// app/(dashboard)/trace/page.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { useDashboardControls } from '@/components/Topbar'

// ── Inline SVG icons (no lucide-react dependency) ─────────────────────────────
const IconHash       = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
)
const IconFileUp     = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
)
const IconKeyRound   = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)
const IconFileText   = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
)
const IconSearch     = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)
const IconDownload   = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
)
const IconChevronLeft  = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
)
const IconChevronRight = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => Number(n).toLocaleString('en-IN')

const TONES: Record<string, { bg: string; text: string; border: string }> = {
  teal:   { bg: 'rgba(32,178,170,0.12)',  text: '#20B2AA', border: 'rgba(32,178,170,0.3)'  },
  coral:  { bg: 'rgba(255,127,80,0.12)',  text: '#FF7F50', border: 'rgba(255,127,80,0.3)'  },
  amber:  { bg: 'rgba(255,191,0,0.12)',   text: '#FFBF00', border: 'rgba(255,191,0,0.3)'   },
  purple: { bg: 'rgba(147,112,219,0.12)', text: '#9370DB', border: 'rgba(147,112,219,0.3)' },
}

function Kpi({ label, value, delta, tone = 'teal' }: { label: string; value: string | number; delta?: string; tone?: string }) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground, #e2e8f0)', lineHeight: 1.1 }}>{value}</div>
      {delta && <div style={{ fontSize: 11, color: 'var(--muted-foreground, #94a3b8)', marginTop: 4, fontFamily: 'monospace' }}>{delta}</div>}
    </div>
  )
}

function Panel({ children, tone = 'teal', eyebrow, actions }: {
  children: React.ReactNode; tone?: string; eyebrow?: string; actions?: React.ReactNode
}) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <div style={{ background: 'var(--card, #1e293b)', border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
      {(eyebrow || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          {eyebrow && <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)' }}>{eyebrow}</span>}
          {actions && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

type SearchMode = 'single' | 'uuid' | 'authcode' | 'bulk'
const MODES = [
  { id: 'single'   as SearchMode, label: 'MSISDN / Search',    desc: 'Search across sender, PE ID, or IP',             tone: 'teal',   Icon: IconHash     },
  { id: 'uuid'     as SearchMode, label: 'Request UUID',        desc: 'Inspect a single submission (not yet supported)', tone: 'purple', Icon: IconFileText },
  { id: 'authcode' as SearchMode, label: 'PEID / Sender',       desc: 'All submissions for a PE or sender',             tone: 'amber',  Icon: IconKeyRound },
  { id: 'bulk'     as SearchMode, label: 'Bulk search',         desc: 'Paste list of senders or PE IDs',                tone: 'coral',  Icon: IconFileUp   },
]

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Trace() {
  const { hours, days, from, to } = useDashboardControls()

  const [mode, setMode]           = useState<SearchMode>('single')
  const [search, setSearch]       = useState('')
  const [sender, setSender]       = useState('')
  const [peId, setPeId]           = useState('')
  const [filterCode, setFilterCode] = useState('')
  const [page, setPage]           = useState(1)

  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (from && to) { params.set('from', from); params.set('to', to) }
    else if (days > 0) params.set('days', String(days))
    else params.set('hours', String(hours))
    if (filterCode)                    params.set('code', filterCode)
    if (mode === 'single' && search)   params.set('search', search)
    if (mode === 'authcode' && sender) params.set('sender', sender)
    if (mode === 'authcode' && peId)   params.set('pe_id', peId)
    return params
  }, [hours, days, from, to, filterCode, mode, search, sender, peId, page])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/trace?${buildParams()}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { load() }, [load])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load() }

  const exportCSV = () => {
    const rows = data?.rows ?? []
    const headers = ['Time', 'Sender', 'PE_ID', 'Step', 'Code', 'Status', 'Source IP']
    const csvRows = rows.map((r: any) =>
      [r.ts, r.sender, r.peId, r.step, r.code, r.status === 1 ? 'passed' : 'blocked', r.ip].join(',')
    )
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'trace_log.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  const kpis  = data?.kpis   ?? {}
  const codes = data?.codes  ?? []
  const rows  = data?.rows   ?? []
  const pag   = data?.pagination ?? {}

  const inputStyle: React.CSSProperties = {
    background: 'var(--secondary, #1e293b)', border: '1px solid var(--border, #334155)',
    borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace',
    color: 'var(--foreground, #e2e8f0)', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#20B2AA', marginBottom: 6 }}>GoFlipo Trace</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground, #e2e8f0)', margin: 0 }}>Submission Log</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #94a3b8)', marginTop: 6 }}>
          Search and inspect every submission attempt in the GoFlipo scrubbing pipeline
        </p>
      </div>

      {/* Mode picker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {MODES.map((m) => {
          const t = TONES[m.tone] ?? TONES.teal
          const active = mode === m.id
          return (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{ all: 'unset', cursor: 'pointer', textAlign: 'left', padding: 16, borderRadius: 14, border: `1px solid ${active ? t.border : 'rgba(148,163,184,0.1)'}`, background: active ? t.bg : 'var(--card, #1e293b)', transition: 'all 0.2s' }}>
              <div style={{ color: t.text, marginBottom: 8 }}>
                <m.Icon size={16} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground, #e2e8f0)' }}>{m.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground, #94a3b8)', marginTop: 4, lineHeight: 1.4 }}>{m.desc}</div>
            </button>
          )
        })}
      </div>

      {/* Search panel */}
      <Panel tone="teal" eyebrow={`Mode · ${MODES.find(m => m.id === mode)!.label}`}>
        <form onSubmit={handleSearch}>
          {mode === 'single' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Search sender, PE ID, or originator IP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#20B2AA', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', fontWeight: 600 }}>
                <IconSearch size={14} /> Trace
              </button>
            </div>
          )}
          {mode === 'uuid' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="UUID lookup not yet supported — use search above" disabled />
            </div>
          )}
          {mode === 'authcode' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input style={inputStyle} placeholder="PEID — e.g. 2026012016513482330" value={peId}   onChange={(e) => setPeId(e.target.value)} />
              <input style={inputStyle} placeholder="Sender ID — e.g. Parimatch"        value={sender} onChange={(e) => setSender(e.target.value)} />
              <button type="submit"
                style={{ padding: '8px 16px', background: '#20B2AA', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                Search
              </button>
            </div>
          )}
          {mode === 'bulk' && (
            <div style={{ border: '1px dashed rgba(148,163,184,0.3)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted-foreground, #94a3b8)', marginBottom: 8 }}>
                <IconFileUp size={24} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Not yet supported in this build</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted-foreground, #94a3b8)' }}>Use the search mode above instead</div>
            </div>
          )}
        </form>
      </Panel>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground, #94a3b8)', fontFamily: 'monospace', marginTop: 20 }}>Loading trace data…</div>}
      {error && (
        <div style={{ background: 'rgba(255,127,80,0.1)', border: '1px solid rgba(255,127,80,0.3)', borderRadius: 10, padding: 16, color: '#FF7F50', fontFamily: 'monospace', marginTop: 20 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20, marginBottom: 20 }}>
            <Kpi label="Records found"    tone="teal"   value={fmt(pag.total ?? 0)} delta={filterCode ? `filtered: ${filterCode}` : 'no filter'} />
            <Kpi label="Passed"           tone="purple" value={fmt(kpis.passed ?? 0)}
              delta={kpis.total > 0 ? `${((kpis.passed / kpis.total) * 100).toFixed(1)}%` : '—'} />
            <Kpi label="Blocked"          tone="coral"  value={fmt(kpis.blocked ?? 0)}
              delta={kpis.total > 0 ? `${((kpis.blocked / kpis.total) * 100).toFixed(1)}%` : '—'} />
            <Kpi label="Distinct senders" tone="amber"  value={fmt(kpis.distinctSenders ?? 0)} />
          </div>

          {/* Error code filter chips */}
          <Panel tone="coral" eyebrow="Filter by error code · click to apply">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => { setFilterCode(''); setPage(1) }}
                style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', border: 'none', background: !filterCode ? 'var(--foreground, #e2e8f0)' : 'var(--muted, #334155)', color: !filterCode ? 'var(--background, #0f172a)' : 'var(--muted-foreground, #94a3b8)' }}>
                All
              </button>
              {codes.map((c: any) => {
                const t = TONES[c.tone] ?? TONES.coral
                const active = filterCode === c.code
                return (
                  <button key={c.code}
                    onClick={() => { setFilterCode(active ? '' : c.code); setPage(1) }}
                    style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', border: 'none', background: active ? t.text : t.bg, color: active ? '#000' : t.text, transition: 'all 0.15s' }}>
                    {c.code} · {c.pct}%
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* Results table */}
          <div style={{ marginTop: 16 }}>
            <Panel tone="teal"
              eyebrow={`Trace results · ${fmt(pag.total ?? 0)} rows`}
              actions={
                <button onClick={exportCSV}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--muted, #334155)', border: 'none', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <IconDownload size={12} /> CSV
                </button>
              }>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['request_time', 'sender', 'pe_id', 'step', 'code', 'status', 'source_ip'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)', paddingBottom: 10, paddingRight: 12, fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={7} style={{ fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', padding: '20px 0', fontSize: 12 }}>No records found for the current filter</td></tr>
                    )}
                    {rows.map((r: any) => {
                      const passed = r.status === 1
                      const t = passed ? TONES.teal : TONES.coral
                      return (
                        <tr key={r.uuid} style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>
                            {String(r.ts).slice(5, 19)}
                          </td>
                          <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>{r.sender}</td>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.peId}>{r.peId}</td>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>{r.step}</td>
                          <td style={{ padding: '8px 12px 8px 0' }}>
                            <span style={{ background: t.bg, color: t.text, fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>{r.code || '—'}</span>
                          </td>
                          <td style={{ padding: '8px 12px 8px 0' }}>
                            <span style={{ background: passed ? TONES.teal.bg : TONES.coral.bg, color: passed ? TONES.teal.text : TONES.coral.text, fontFamily: 'monospace', fontSize: 10.5, padding: '2px 7px', borderRadius: 5 }}>
                              {passed ? 'passed' : 'blocked'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>{r.ip}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pag.pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 12 }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>
                    Page {page} of {pag.pages} · {fmt(pag.total)} rows
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', background: 'var(--muted, #334155)', border: 'none', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, color: 'var(--foreground, #e2e8f0)' }}>
                      <IconChevronLeft size={14} />
                    </button>
                    <button onClick={() => setPage(p => Math.min(pag.pages, p + 1))} disabled={page >= pag.pages}
                      style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', background: 'var(--muted, #334155)', border: 'none', borderRadius: 6, cursor: page >= pag.pages ? 'not-allowed' : 'pointer', opacity: page >= pag.pages ? 0.4 : 1, color: 'var(--foreground, #e2e8f0)' }}>
                      <IconChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* Column reference */}
          <div style={{ marginTop: 16 }}>
            <Panel tone="purple" eyebrow="ClickHouse columns mapped · sms_cdr table">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
                {['timestamp', 'sender_id', 'pe_id', 'originator_ip', 'dlr_code', 'dispatch_status', 'validation_step'].map((c) => (
                  <div key={c} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(148,163,184,0.06)', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--muted-foreground, #94a3b8)' }}>
                    {c}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted-foreground, #94a3b8)' }}>
                Trace reads from <span style={{ fontFamily: 'monospace', color: 'var(--foreground, #e2e8f0)' }}>goflipo.sms_cdr</span>. Dispatch status 1 = passed, others = blocked.
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
