'use client'
// app/(dashboard)/mis/page.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { useDashboardControls } from '@/components/Topbar'
// no external icon deps
// Inline SVG — no lucide-react needed
const IconDownload = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
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

function Panel({ children, tone = 'teal', eyebrow, actions, className }: {
  children: React.ReactNode; tone?: string; eyebrow?: string; actions?: React.ReactNode; className?: string
}) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <div className={className} style={{ background: 'var(--card, #1e293b)', border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
      {(eyebrow || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {eyebrow && <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)' }}>{eyebrow}</span>}
          {actions && <div style={{ display: 'flex', gap: 6 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function Bar({ pct, tone = 'teal', height = 5 }: { pct: number; tone?: string; height?: number }) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <div style={{ background: 'var(--muted, #334155)', borderRadius: 999, overflow: 'hidden', height }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: t.text, borderRadius: 999, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)', marginBottom: 6 }}>
        {label}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', background: 'var(--secondary, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--foreground, #e2e8f0)' }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
}

const DIM_OPTIONS = ['sender', 'pe_id', 'ip', 'error_code', 'step']
const DIM_LABELS  = { sender: 'Sender', pe_id: 'PEID', ip: 'Source IP', error_code: 'Error code', step: 'Validation step' }
const GRAN_OPTIONS = ['hourly', 'daily', 'weekly', 'monthly']

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MIS() {
  const { hours, days, from, to } = useDashboardControls()
  const [dim, setDim]           = useState('sender')
  const [gran, setGran]         = useState('daily')
  const [traffic, setTraffic]   = useState('All')
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [generated, setGenerated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setGenerated(true)
    try {
      const params = new URLSearchParams({ dim, gran })
      if (from && to) { params.set('from', from); params.set('to', to) }
      else if (days > 0) params.set('days', String(days))
      else params.set('hours', String(hours))
      const res = await fetch(`/api/mis?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [hours, days, from, to, dim, gran])

  // Auto-load on mount
  useEffect(() => { load() }, [load])

  const kpis       = data?.kpis       ?? {}
  const rows       = data?.rows       ?? []
  const errorDist  = data?.errorDist  ?? []
  const senderBlock = data?.senderBlock ?? []
  const maxBlock   = Math.max(...senderBlock.map((s: any) => Number(s.blockPct)), 1)

  const exportCSV = () => {
    const headers = ['Dimension', 'Date', 'Submitted', 'Passed', 'Blocked', 'Pass%', 'Top Error']
    const csvRows = rows.map((r: any) =>
      [r.dimension, r.date, r.submitted, r.passed, r.blocked, r.passPct, r.topErr].join(',')
    )
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'mis_report.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#20B2AA', marginBottom: 6 }}>GoFlipo Reporting</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground, #e2e8f0)', margin: 0 }}>MIS Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #94a3b8)', marginTop: 6 }}>
          Cross-dimension reports — sender, PEID, error code, source IP, validation step
        </p>
      </div>

      {/* Config panel */}
      <Panel tone="teal" eyebrow="Report configuration" className="mb-6" style={{ marginBottom: 20 } as any}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Field label="Dimension"   value={dim}     onChange={setDim}     options={DIM_OPTIONS} />
          <Field label="Granularity" value={gran}    onChange={setGran}    options={GRAN_OPTIONS} />
          <Field label="Traffic"     value={traffic} onChange={setTraffic} options={['All', 'Domestic', 'International']} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={load} style={{ padding: '8px 20px', fontSize: 12, background: '#20B2AA', color: '#000', border: 'none', borderRadius: 8, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? 'Loading…' : 'Generate report'}
          </button>
        </div>
      </Panel>

      {error && (
        <div style={{ background: 'rgba(255,127,80,0.1)', border: '1px solid rgba(255,127,80,0.3)', borderRadius: 10, padding: 16, color: '#FF7F50', fontFamily: 'monospace', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Kpi label="Total submitted"  tone="teal"   value={fmt(kpis.totalSubmitted ?? 0)}   delta="in window" />
            <Kpi label="Passed"           tone="purple" value={fmt(kpis.totalPassed ?? 0)}
              delta={kpis.totalSubmitted > 0 ? `${((kpis.totalPassed / kpis.totalSubmitted) * 100).toFixed(1)}%` : '—'} />
            <Kpi label="Blocked"          tone="coral"  value={fmt(kpis.totalBlocked ?? 0)}
              delta={kpis.totalSubmitted > 0 ? `${((kpis.totalBlocked / kpis.totalSubmitted) * 100).toFixed(1)}%` : '—'} />
            <Kpi label="Distinct senders" tone="amber"  value={fmt(kpis.distinctSenders ?? 0)} />
            <Kpi label="Top error"        tone="coral"  value={kpis.topError ?? '—'} delta="most frequent" />
          </div>

          {/* Main table + error dist */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            <Panel tone="coral" eyebrow={`MIS · grouped by ${DIM_LABELS[dim as keyof typeof DIM_LABELS] ?? dim} · ${gran}`}
              actions={
                <>
                  <button onClick={exportCSV}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--muted, #334155)', border: 'none', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <IconDownload size={12} /> CSV
                  </button>
                </>
              }>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[DIM_LABELS[dim as keyof typeof DIM_LABELS] ?? 'Dimension', 'Date', 'Submitted', 'Passed', 'Blocked', 'Pass %', 'Top error'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)', paddingBottom: 10, paddingRight: 12, fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={7} style={{ fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', padding: '16px 0', fontSize: 12 }}>No data in window</td></tr>
                    )}
                    {rows.slice(0, 100).map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                        <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dimension}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>{r.date}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace' }}>{fmt(r.submitted)}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: '#9370DB' }}>{fmt(r.passed)}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: '#FF7F50' }}>{fmt(r.blocked)}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: r.passPct < 5 ? '#FF7F50' : '#9370DB', fontWeight: r.passPct < 5 ? 700 : 400 }}>
                          {Number(r.passPct).toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px 12px 8px 0' }}>
                          <span style={{ background: 'rgba(255,127,80,0.12)', color: '#FF7F50', fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>
                            {r.topErr}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    {rows.length > 0 && (
                      <tr style={{ borderTop: '2px solid rgba(148,163,184,0.2)', background: 'rgba(148,163,184,0.04)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted-foreground, #94a3b8)' }}>Totals</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace' }}>{fmt(kpis.totalSubmitted)}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: '#9370DB' }}>{fmt(kpis.totalPassed)}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: '#FF7F50' }}>{fmt(kpis.totalBlocked)}</td>
                        <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace' }}>
                          {kpis.totalSubmitted > 0 ? ((kpis.totalPassed / kpis.totalSubmitted) * 100).toFixed(2) : '0.00'}%
                        </td>
                        <td style={{ padding: '8px 12px 8px 0' }}>
                          <span style={{ background: 'rgba(255,127,80,0.12)', color: '#FF7F50', fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>{kpis.topError}</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel tone="purple" eyebrow="Error-code distribution">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {errorDist.length === 0 && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>No errors in window</div>}
                {errorDist.map((e: any) => (
                  <div key={e.code}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)', marginRight: 6 }}>{e.code}</span>
                        <span style={{ fontWeight: 600 }}>{e.count}</span>
                      </span>
                      <span style={{ fontFamily: 'monospace' }}>{e.pct}%</span>
                    </div>
                    <Bar pct={e.pct} tone={e.tone ?? 'coral'} height={4} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Sender block rate */}
          <Panel tone="amber" eyebrow="Sender block rate · all senders in window">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {senderBlock.length === 0 && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>No sender data</div>}
              {senderBlock.map((s: any) => (
                <div key={s.sender} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 120, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sender}</span>
                  <div style={{ flex: 1 }}>
                    <Bar pct={s.blockPct} tone="coral" height={4} />
                  </div>
                  <span style={{ width: 64, textAlign: 'right', fontFamily: 'monospace', fontSize: 11.5 }}>{fmt(s.total)}</span>
                  <span style={{ width: 48, textAlign: 'right', fontFamily: 'monospace', fontSize: 11.5, color: '#FF7F50' }}>{s.blockPct}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
