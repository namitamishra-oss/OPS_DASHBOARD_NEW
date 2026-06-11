'use client'
// app/(dashboard)/tps/page.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { useDashboardControls } from '@/components/Topbar'

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number | string) =>
  Number.isNaN(Number(n)) ? String(n) : Number(n).toLocaleString('en-IN')

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
      <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: t.text, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground, #e2e8f0)', lineHeight: 1.1 }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 11, color: 'var(--muted-foreground, #94a3b8)', marginTop: 4, fontFamily: 'monospace' }}>
          {delta}
        </div>
      )}
    </div>
  )
}

function Panel({
  children, tone = 'teal', eyebrow, actions,
}: {
  children: React.ReactNode; tone?: string; eyebrow?: string; actions?: React.ReactNode
}) {
  const t = TONES[tone] ?? TONES.teal
  return (
    <div style={{ background: 'var(--card, #1e293b)', border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
      {(eyebrow || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {eyebrow && (
            <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)' }}>
              {eyebrow}
            </span>
          )}
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TPS() {
  const { hours, days, from, to } = useDashboardControls()
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (from && to) { params.set('from', from); params.set('to', to) }
      else if (days > 0) params.set('days', String(days))
      else params.set('hours', String(hours))
      const res = await fetch(`/api/tps?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [hours, days, from, to])

  useEffect(() => { load() }, [load])

  const hourly  = data?.hourly  ?? []
  const steps   = data?.steps   ?? []
  const ips     = data?.ips     ?? []
  const slow    = data?.slow    ?? []
  const kpis    = data?.kpis    ?? {}
  const maxC    = Math.max(...hourly.map((h: any) => Number(h.count)), 1)
  const maxL    = Math.max(...hourly.map((h: any) => Number(h.latency_ms)), 1)
  const maxStep = Math.max(...steps.map((s: any) => Number(s.count)), 1)
  const maxIp   = Math.max(...ips.map((ip: any) => Number(ip.count)), 1)

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#20B2AA', marginBottom: 6 }}>
          GoFlipo Throughput
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground, #e2e8f0)', margin: 0 }}>
          TPS &amp; Latency Monitor
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #94a3b8)', marginTop: 6 }}>
          Live throughput and validation latency for the GoFlipo scrubbing pipeline
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-foreground, #94a3b8)', fontFamily: 'monospace' }}>
          Loading TPS data…
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(255,127,80,0.1)', border: '1px solid rgba(255,127,80,0.3)', borderRadius: 10, padding: 16, color: '#FF7F50', fontFamily: 'monospace', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Kpi label="Current TPS"           tone="teal"   value={kpis.currentTps}       delta="msgs / second" />
            <Kpi label="Peak TPS"              tone="purple" value={kpis.peakTps}           delta={`at ${kpis.peakHour}`} />
            <Kpi label="Total submissions"     tone="amber"  value={fmt(kpis.totalSubmissions)} delta="in window" />
            <Kpi label="Avg validation latency" tone="teal"   value={`${kpis.avgLatency}ms`} delta="P50 est." />
            <Kpi label="P99 latency est."       tone="coral"  value={kpis.p99Latency}         delta="slowest 1%" />
          </div>

          {/* Hourly charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Panel tone="teal" eyebrow="Submissions per hour">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
                {hourly.map((h: any, i: number) => (
                  <div key={i} title={`${h.hour} · ${fmt(h.count)}`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{
                      width: '100%', background: '#20B2AA', borderRadius: '3px 3px 0 0',
                      height: `${(Number(h.count) / maxC) * 100}%`, minHeight: 2,
                      opacity: 0.75, cursor: 'default', transition: 'opacity 0.2s',
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>
            </Panel>

            <Panel tone="amber" eyebrow="Validation latency (estimated ms / hour)">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
                {hourly.map((h: any, i: number) => (
                  <div key={i}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{
                      width: '100%', borderRadius: '3px 3px 0 0',
                      height: `${(Number(h.latency_ms) / maxL) * 100}%`, minHeight: 2,
                      background: Number(h.latency_ms) > maxL * 0.7 ? '#FF7F50' : '#FFBF00',
                      opacity: 0.75,
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)' }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>
            </Panel>
          </div>

          {/* Bottlenecks + IPs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Panel tone="coral" eyebrow="Throughput by validation step">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {steps.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-foreground, #94a3b8)', fontFamily: 'monospace' }}>No step data in window</div>}
                {steps.map((s: any, i: number) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{s.step}</span>
                      <span style={{ fontFamily: 'monospace', tabularNums: true } as any}>{fmt(s.count)}</span>
                    </div>
                    <Bar pct={(Number(s.count) / maxStep) * 100} tone={i % 2 === 0 ? 'coral' : 'amber'} height={4} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel tone="amber" eyebrow="Top source IPs · originator_ip">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ips.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-foreground, #94a3b8)', fontFamily: 'monospace' }}>No IP data in window</div>}
                {ips.map((ip: any, i: number) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ip.ip}</span>
                      <span style={{ fontFamily: 'monospace' }}>{fmt(ip.count)}</span>
                    </div>
                    <Bar pct={(Number(ip.count) / maxIp) * 100} tone="amber" height={4} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Slowest senders table */}
          <Panel tone="coral" eyebrow="High-block senders · top by blocked count" actions={
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#FF7F50', background: 'rgba(255,127,80,0.12)', padding: '3px 8px', borderRadius: 6 }}>live</span>
          }>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Sender', 'Step', 'Code', 'Total', 'Blocked', 'Block %'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground, #94a3b8)', paddingBottom: 10, paddingRight: 12, fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slow.length === 0 && (
                    <tr><td colSpan={6} style={{ fontFamily: 'monospace', color: 'var(--muted-foreground, #94a3b8)', padding: '16px 0', fontSize: 12 }}>No blocked senders in window</td></tr>
                  )}
                  {slow.map((r: any, i: number) => {
                    const blockPct = r.total > 0 ? ((r.blocked / r.total) * 100).toFixed(1) : '0'
                    return (
                      <tr key={i} style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                        <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>{r.sender}</td>
                        <td style={{ padding: '10px 12px 10px 0', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>{r.step}</td>
                        <td style={{ padding: '10px 12px 10px 0' }}>
                          <span style={{ background: 'rgba(255,127,80,0.15)', color: '#FF7F50', fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>{r.code}</span>
                        </td>
                        <td style={{ padding: '10px 12px 10px 0', fontFamily: 'monospace' }}>{fmt(r.total)}</td>
                        <td style={{ padding: '10px 12px 10px 0', fontFamily: 'monospace', color: '#FF7F50' }}>{fmt(r.blocked)}</td>
                        <td style={{ padding: '10px 12px 10px 0', fontFamily: 'monospace', fontWeight: 600, color: Number(blockPct) > 50 ? '#FF7F50' : '#FFBF00' }}>{blockPct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
