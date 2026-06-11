'use client'
// app/(dashboard)/scrubbing/page.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { useDashboardControls } from '@/components/Topbar'

// Inline SVG icons — no lucide-react needed
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

function Panel({ children, tone = 'teal', eyebrow, actions }: {
  children: React.ReactNode; tone?: string; eyebrow?: string; actions?: React.ReactNode
}) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <div style={{ background: 'var(--card, #1e293b)', border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
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

function Pill({ children, tone = 'teal' }: { children: React.ReactNode; tone?: string }) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <span style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, fontFamily: 'monospace', fontSize: 10.5, padding: '2px 8px', borderRadius: 99 }}>
      {children}
    </span>
  )
}

function ActionBtn({ onClick, icon, label }: { onClick?: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--muted, #334155)', border: 'none', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      {icon} {label}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Scrubbing() {
  const { hours, days, from, to } = useDashboardControls()
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [data, setData]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (activeStep) params.set('step', activeStep)
      if (from && to) { params.set('from', from); params.set('to', to) }
      else if (days > 0) params.set('days', String(days))
      else params.set('hours', String(hours))
      const res = await fetch(`/api/scrubbing?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [hours, days, from, to, activeStep])

  useEffect(() => { load() }, [load])

  const kpis  = data?.kpis  ?? {}
  const steps = data?.steps ?? []
  const codes = data?.codes ?? []
  const ips   = data?.ips   ?? []
  const log   = data?.log   ?? []

  const exportCSV = () => {
    const headers = ['Time', 'Sender', 'PE_ID', 'Step', 'Code', 'Source IP']
    const csvRows = log.map((r: any) =>
      [r.ts, r.sender, r.peId, r.step, r.code, r.ip].join(',')
    )
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'scrubbing_log.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#20B2AA', marginBottom: 6 }}>GoFlipo Scrubbing</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground, #e2e8f0)', margin: 0 }}>Scrubbing &amp; Block Analysis</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #94a3b8)', marginTop: 6 }}>
          Validation steps, error codes, and the audit trail of every blocked submission
        </p>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-foreground, #94a3b8)', fontFamily: 'monospace' }}>Loading scrubbing data…</div>}
      {error && (
        <div style={{ background: 'rgba(255,127,80,0.1)', border: '1px solid rgba(255,127,80,0.3)', borderRadius: 10, padding: 16, color: '#FF7F50', fontFamily: 'monospace', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Kpi label="Total submitted" tone="teal"   value={fmt(kpis.totalSubmitted ?? 0)} delta="in window" />
            <Kpi label="Passed"          tone="purple" value={fmt(kpis.totalPassed ?? 0)}
              delta={kpis.totalSubmitted > 0 ? `${((kpis.totalPassed / kpis.totalSubmitted) * 100).toFixed(2)}%` : '—'} />
            <Kpi label="Blocked"         tone="coral"  value={fmt(kpis.totalBlocked ?? 0)}
              delta={kpis.totalSubmitted > 0 ? `${((kpis.totalBlocked / kpis.totalSubmitted) * 100).toFixed(2)}%` : '—'} />
            <Kpi label="Worst step"      tone="amber"  value={kpis.worstStep ?? '—'}   delta="most blocks" />
            <Kpi label="Top error"       tone="coral"  value={kpis.topError ?? '—'}    delta="most frequent" />
          </div>

          {/* Step breakdown + code drilldown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Panel tone="coral" eyebrow="Blocks by validation step · click to filter">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {steps.length === 0 && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>No step data in window</div>}
                {steps.map((s: any) => {
                  const active = activeStep === s.step
                  const t = TONES[s.tone] ?? TONES.coral
                  return (
                    <button key={s.step} onClick={() => setActiveStep(active ? null : s.step)}
                      style={{ all: 'unset', cursor: 'pointer', width: '100%', display: 'block', opacity: active ? 1 : 0.85, transition: 'opacity 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{s.label}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmt(s.count)}</span>
                      </div>
                      <div style={{ background: 'var(--muted, #334155)', borderRadius: 999, overflow: 'hidden', height: 5 }}>
                        <div style={{ height: '100%', width: `${s.pct}%`, background: active ? t.text : `${t.text}99`, borderRadius: 999, transition: 'width 0.4s ease, background 0.2s' }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </Panel>

            <Panel tone="purple" eyebrow={activeStep ? `Codes within · ${activeStep}` : 'Error codes · all steps'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {codes.length === 0 && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>No error codes in window</div>}
                {codes.map((c: any) => {
                  const t = TONES[c.tone] ?? TONES.coral
                  return (
                    <div key={c.code} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 80px 56px', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                      <span style={{ background: t.bg, color: t.text, fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5, textAlign: 'center' }}>{c.code}</span>
                      <span style={{ fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt(c.count)}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'right' }}>{c.count}</span>
                      <Pill tone={c.tone}>{c.pct}%</Pill>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>

          {/* Source IPs */}
          {ips.length > 0 && (
            <Panel tone="amber" eyebrow="Source IPs · top originator IPs causing blocks">
              <div style={{ display: 'grid', gridTemplateColumns: ips.length === 1 ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {ips.map((ip: any) => (
                  <div key={ip.ip} style={{ borderRadius: 10, background: 'rgba(148,163,184,0.04)', padding: 14, border: '1px solid rgba(148,163,184,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{ip.ip}</span>
                      <Pill tone="amber">high traffic</Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--muted-foreground, #94a3b8)' }}>
                      <span>Blocked</span>
                      <span style={{ fontFamily: 'monospace' }}>{fmt(ip.count)} · {ip.pct}%</span>
                    </div>
                    <Bar pct={ip.pct} tone="amber" height={4} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Block audit log */}
          <div style={{ marginTop: 20 }}>
            <Panel tone="coral"
              eyebrow={`Block audit log · ${fmt(log.length)} rows${activeStep ? ` · step=${activeStep}` : ''}`}
              actions={
                <>
                  {activeStep && (
                    <button onClick={() => setActiveStep(null)}
                      style={{ padding: '4px 10px', background: 'var(--muted, #334155)', border: 'none', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', cursor: 'pointer' }}>
                      Clear ✕
                    </button>
                  )}
                  <ActionBtn onClick={exportCSV} icon={<IconDownload size={12} />} label="CSV" />
                </>
              }>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['request_time', 'sender', 'pe_id', 'step', 'code', 'source_ip'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)', paddingBottom: 10, paddingRight: 12, fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.length === 0 && (
                      <tr><td colSpan={6} style={{ fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', padding: '16px 0', fontSize: 12 }}>No blocked submissions in window</td></tr>
                    )}
                    {log.map((r: any) => {
                      const tone = TONES.coral
                      return (
                        <tr key={r.uuid} style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', fontSize: 11 }}>
                            {String(r.ts).slice(5, 19)}
                          </td>
                          <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>{r.sender}</td>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>{r.peId}</td>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>{r.step}</td>
                          <td style={{ padding: '8px 12px 8px 0' }}>
                            <span style={{ background: tone.bg, color: tone.text, fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>{r.code}</span>
                          </td>
                          <td style={{ padding: '8px 12px 8px 0', fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>{r.ip}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted-foreground, #94a3b8)' }}>
                Showing up to 50 blocked submissions
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
