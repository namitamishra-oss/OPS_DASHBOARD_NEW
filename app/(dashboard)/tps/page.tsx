'use client'
// app/(dashboard)/tps/page.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { useDashboardControls } from '@/components/Topbar'

const fmt = (n: number | string) => Number(n).toLocaleString('en-IN')
const T = {
  teal:   { bg: 'hsl(var(--teal-bg))',   text: 'hsl(var(--teal-text))',   border: 'hsl(var(--teal-border))'   },
  coral:  { bg: 'hsl(var(--coral-bg))',  text: 'hsl(var(--coral-text))',  border: 'hsl(var(--coral-border))'  },
  amber:  { bg: 'hsl(var(--amber-bg))',  text: 'hsl(var(--amber-text))',  border: 'hsl(var(--amber-border))'  },
  purple: { bg: 'hsl(var(--purple-bg))', text: 'hsl(var(--purple-text))', border: 'hsl(var(--purple-border))' },
}
type Tone = keyof typeof T

function Kpi({ label, value, sub, tone='teal' }: any) {
  const c = T[tone as Tone]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: c.text, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 3, fontFamily: 'monospace' }}>{sub}</div>}
    </div>
  )
}
function Card({ children, tone='teal', label, action }: any) {
  const c = T[tone as Tone]
  return (
    <div style={{ background: 'hsl(var(--surface-1))', border: `1px solid ${c.border}`, borderRadius: 14, padding: '16px 18px' }}>
      {(label || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {label && <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))' }}>{label}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

const TRAFFIC_OPTS = [{ id: 'all', label: 'All' }, { id: 'domestic', label: '🏠 Domestic' }, { id: 'international', label: '✈️ Intl' }]

export default function TPS() {
  const { toApiParams, refreshTick } = useDashboardControls()
  const [traffic, setTraffic] = useState('all')
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const api = toApiParams()
      const p   = new URLSearchParams()
      if (api.from && api.to) { p.set('from', api.from); p.set('to', api.to) }
      else if (api.days)        p.set('days',  String(api.days))
      else                      p.set('hours', String(api.hours ?? 24))
      if (traffic !== 'all')    p.set('traffic', traffic)
      const res = await fetch(`/api/tps?${p}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [toApiParams, traffic, refreshTick])

  useEffect(() => { load() }, [load])

  const kpis   = data?.kpis   ?? {}
  const hourly = data?.hourly ?? []
  const steps  = data?.steps  ?? []
  const ips    = data?.ips    ?? []
  const slow   = data?.slow   ?? []
  const maxC   = Math.max(...hourly.map((h: any) => Number(h.count)), 1)
  const maxS   = Math.max(...steps.map((s: any) => Number(s.count)), 1)
  const maxI   = Math.max(...ips.map((ip: any) => Number(ip.count)), 1)

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#20B2AA', marginBottom: 5 }}>GoFlipo · Throughput</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'hsl(var(--foreground))', margin: 0 }}>TPS &amp; Latency Monitor</h1>
          <div style={{ display: 'flex', gap: 3, background: 'hsl(var(--muted))', padding: 3, borderRadius: 9 }}>
            {TRAFFIC_OPTS.map(o => (
              <button key={o.id} onClick={() => setTraffic(o.id)}
                style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: traffic === o.id ? '#20B2AA' : 'transparent', color: traffic === o.id ? '#000' : 'var(--muted-foreground,#94a3b8)',
                  fontWeight: traffic === o.id ? 700 : 400, transition: 'all 0.15s' }}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>Loading…</div>}
      {error   && <div style={{ background: T.coral.bg, border: `1px solid ${T.coral.border}`, borderRadius: 10, padding: 14, color: T.coral.text, fontFamily: 'monospace', fontSize: 12 }}>⚠ {error}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
            <Kpi label="Current TPS"    tone="teal"   value={kpis.currentTps}     sub="msgs/sec" />
            <Kpi label="Peak TPS"       tone="purple" value={kpis.peakTps}         sub={`at ${kpis.peakHour}`} />
            <Kpi label="Messages"        tone="amber"  value={fmt(kpis.totalSubmissions)} sub={kpis.totalSegments ? `${fmt(kpis.totalSegments)} segments` : 'in window'} />
            <Kpi label="Avg latency"    tone="teal"   value={kpis.avgLatency}      sub="P50 est." />
            <Kpi label="P99 latency"    tone="coral"  value={kpis.p99Latency}      sub="slowest 1%" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Card tone="teal" label="Submissions per hour">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
                {hourly.map((h: any, i: number) => (
                  <div key={i} title={`${h.hour} · ${fmt(h.count)}`}
                    style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                    <div style={{ width: '100%', background: '#20B2AA', borderRadius: '3px 3px 0 0', height: `${(Number(h.count)/maxC)*100}%`, minHeight: 2, opacity: 0.75 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>
            </Card>

            <Card tone="amber" label="Estimated latency per hour">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
                {hourly.map((h: any, i: number) => {
                  const maxL = Math.max(...hourly.map((x: any) => Number(x.latency_ms)), 1)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                      <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${(Number(h.latency_ms)/maxL)*100}%`, minHeight: 2, background: Number(h.latency_ms) > maxL * 0.7 ? '#FF7F50' : '#F5A623', opacity: 0.75 }} />
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Card tone="coral" label="Throughput by validation step">
              {steps.map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{s.step}</span>
                    <span style={{ fontFamily: 'monospace' }}>{fmt(s.count)}</span>
                  </div>
                  <div style={{ background: 'hsl(var(--muted))', borderRadius: 999, overflow: 'hidden', height: 4 }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, background: T.coral.text, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
              {steps.length === 0 && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>No step data</div>}
            </Card>

            <Card tone="amber" label="Top source IPs">
              {ips.map((ip: any, i: number) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ip.ip}</span>
                    <span style={{ fontFamily: 'monospace' }}>{fmt(ip.count)}</span>
                  </div>
                  <div style={{ background: 'hsl(var(--muted))', borderRadius: 999, overflow: 'hidden', height: 4 }}>
                    <div style={{ height: '100%', width: `${ip.pct}%`, background: T.amber.text, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <Card tone="coral" label="High-block senders">
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Sender', 'Step', 'Code', 'Total', 'Blocked', 'Block %'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))', paddingBottom: 10, paddingRight: 14, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slow.length === 0 && <tr><td colSpan={6} style={{ fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', padding: '16px 0', fontSize: 12 }}>No blocked senders</td></tr>}
                {slow.map((r: any, i: number) => {
                  const bp = r.total > 0 ? ((r.blocked / r.total) * 100).toFixed(1) : '0'
                  return (
                    <tr key={i} style={{ borderTop: '1px solid hsl(var(--border))' }}>
                      <td style={{ padding: '9px 14px 9px 0', fontWeight: 600 }}>{r.sender}</td>
                      <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{r.step}</td>
                      <td style={{ padding: '9px 14px 9px 0' }}><span style={{ background: T.coral.bg, color: T.coral.text, fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5 }}>{r.code}</span></td>
                      <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace' }}>{fmt(r.total)}</td>
                      <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace', color: T.coral.text }}>{fmt(r.blocked)}</td>
                      <td style={{ padding: '9px 14px 9px 0', fontFamily: 'monospace', fontWeight: 700, color: Number(bp) > 50 ? T.coral.text : T.amber.text }}>{bp}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
