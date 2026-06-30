'use client'

import { useEffect, useState } from 'react'
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
type Tone = 'coral' | 'amber' | 'purple' | 'teal'
const TXT:  Record<Tone, string> = { coral: 'hsl(var(--coral-text))', amber: 'hsl(var(--amber-text))', purple: 'hsl(var(--purple-text))', teal: 'hsl(var(--teal-text))' }
const BG:   Record<Tone, string> = { coral: 'hsl(var(--coral-bg))', amber: 'hsl(var(--amber-bg))', purple: 'hsl(var(--purple-bg))', teal: 'hsl(var(--teal-bg))' }
const BDR:  Record<Tone, string> = { coral: 'hsl(var(--coral-border))', amber: 'hsl(var(--amber-border))', purple: 'hsl(var(--purple-border))', teal: 'hsl(var(--teal-border))' }

function validatorTone(v: string): Tone {
  if (!v) return 'coral'
  const l = v.toLowerCase()
  if (l.includes('url') || l.includes('tmpl') || l.includes('content')) return 'coral'
  if (l.includes('ip')  || l.includes('route') || l.includes('subnet')) return 'amber'
  if (l.includes('auth')|| l.includes('header')) return 'purple'
  return 'teal'
}
function severityTone(s: string | number): Tone {
  const n = Number(s)
  if (n >= 3) return 'coral'
  if (n === 2) return 'amber'
  return 'purple'
}

// ── Primitives ────────────────────────────────────────────────────────────────
function Pill({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: BG[tone], color: TXT[tone], fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
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

function KpiCard({ label, value, sub, tone, live }: { label: string; value: React.ReactNode; sub?: string; tone: Tone; live?: boolean }) {
  return (
    <div style={{ background: 'hsl(var(--surface-1))', border: `1px solid hsl(var(--border))`, borderRadius: 12, padding: '18px 20px', borderTop: `3px solid ${TXT[tone]}` }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: TXT['teal'], display: 'inline-block' }} />}
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: TXT[tone], lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{sub}</div>}
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
        <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid hsl(var(--border))' }}>
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

function SectionLabel({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
      <div style={{ height: 1, width: 24, background: TXT[tone], borderRadius: 1 }} />
      <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: TXT[tone] }}>{children}</span>
    </div>
  )
}

function TrendChart({ data }: { data: any[] }) {
  if (!data.length) return <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>No data</div>
  const max = Math.max(...data.map(d => num(d.failed)), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
      {data.map((d, i) => {
        const h = Math.max((num(d.failed) / max) * 56, 2)
        const label = d.bucket?.slice(11, 13) || d.bucket?.slice(5, 10) || String(i)
        const isHigh = num(d.failed) > max * 0.7
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: '100%', height: h, background: isHigh ? 'hsl(var(--coral-text))' : 'hsl(var(--coral-border))', borderRadius: '2px 2px 0 0', transition: 'height 0.4s ease' }}
              title={`${label} — ${fmt(d.failed)} failed`} />
            {(i % Math.ceil(data.length / 8) === 0) &&
              <span style={{ fontSize: 7.5, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{label}</span>}
          </div>
        )
      })}
    </div>
  )
}

function DrillPanel({ code, affected }: {
  code: any | null
  affected: { sender_id: string; cnt: number }[]
}) {
  const tone: Tone = code ? severityTone(code.severity) : 'coral'
  return (
    <div style={{
      background: code ? BG[tone] : 'hsl(var(--surface-2))',
      border: `1px solid ${code ? BDR[tone] : 'hsl(var(--border))'}`,
      borderTop: `3px solid ${code ? TXT[tone] : 'hsl(var(--border))'}`,
      borderRadius: 12, padding: 18, minHeight: 200,
    }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: code ? TXT[tone] : 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
        {code ? `Drill · ${code.dlr_code}` : 'Select an error code'}
      </div>
      {code ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 3 }}>{code.name}</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))', marginBottom: 14 }}>{code.validator}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['Count', fmt(code.cnt), 'hsl(var(--surface-1))'], ['Share', pct(code.pct), TXT[tone]]].map(([lbl, val, col]) => (
              <div key={lbl} style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 9.5, fontFamily: 'monospace', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: col as string }}>{val}</div>
              </div>
            ))}
          </div>
          {affected.length > 0 && (
            <>
              <div style={{ fontSize: 9.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>Top affected senders</div>
              {affected.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 12.5 }}>
                  <span style={{ fontFamily: 'monospace', color: 'hsl(var(--foreground))' }}>{s.sender_id}</span>
                  <span style={{ fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>{fmt(s.cnt)}</span>
                </div>
              ))}
            </>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', paddingTop: 24, textAlign: 'center', fontFamily: 'monospace' }}>Click an error code to inspect</div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function FailuresPage() {
  const { toApiParams, refreshTick } = useDashboardControls()

  const [data,         setData]         = useState<any>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [filterSender, setFilterSender] = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [selected,     setSelected]     = useState<any>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      const ap = toApiParams()
      if (ap.hours) params.set('hours', String(ap.hours))
      if (ap.days)  params.set('days',  String(ap.days))
      if (ap.from)  params.set('from',  ap.from)
      if (ap.to)    params.set('to',    ap.to)
      if (filterSender) params.set('sender', filterSender)
      if (filterCat)    params.set('cat',    filterCat)

      const res  = await fetch(`/api/failures?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setData(json)
      if (json.errorCodes?.[0] && !selected) setSelected(json.errorCodes[0])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // Reload when time range changes (refreshTick covers both auto and manual)
  useEffect(() => { load() }, [refreshTick, filterSender, filterCat])

  // ── Derived ────────────────────────────────────────────────────────────────
  const kpi        = data?.kpi         ?? {}
  const categories = data?.categories  ?? []
  const errorCodes = data?.errorCodes  ?? []
  const bySender   = data?.bySender    ?? []
  const bySubnet   = data?.bySubnet    ?? []
  const byStep     = data?.byStep      ?? []
  const traceLog   = data?.traceLog    ?? []
  const trend      = data?.trend       ?? []
  const senderList = data?.senderList  ?? []
  const affected   = selected ? (data?.affectedBySender?.[selected.dlr_code] ?? []) : []

  const C = { bg: 'hsl(var(--surface-2))', card: 'hsl(var(--surface-1))', border: 'hsl(var(--border))', text: 'hsl(var(--foreground))', muted: 'hsl(var(--muted-foreground))' }

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', fontSize: 13, color: C.text }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: TXT['coral'], fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>GOFLIPO · FAILURES</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Failure Analysis</h1>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Error codes, root causes &amp; impact · time range controlled from the top bar</div>
          </div>
          {loading && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--muted-foreground))' }}>Loading…</span>}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 12, background: 'hsl(var(--coral-bg))', border: '1px solid #fca5a5', color: 'hsl(var(--coral-text))' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>Filter</span>
        <select value={filterSender} onChange={e => setFilterSender(e.target.value)}
          style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'hsl(var(--surface-2))', fontFamily: 'monospace', cursor: 'pointer', minWidth: 160 }}>
          <option value=''>All senders</option>
          {senderList.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'hsl(var(--surface-2))', fontFamily: 'monospace', cursor: 'pointer', minWidth: 160 }}>
          <option value=''>All validators</option>
          {categories.map((c: any) => <option key={c.validator} value={c.validator}>{c.validator}</option>)}
        </select>
        {(filterSender || filterCat) && (
          <button onClick={() => { setFilterSender(''); setFilterCat('') }}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontFamily: 'monospace' }}>
            Clear ✕
          </button>
        )}
      </div>

      {/* ── KPI strip ── */}
      <SectionLabel tone='coral'>Key Metrics</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 4 }}>
        <KpiCard label='Total failures'        value={fmt(kpi.failed)}             sub={`${pct(kpi.fail_pct)} of traffic`}            tone='coral' live />
        <KpiCard label='Distinct error codes'  value={fmt(kpi.distinct_codes)}     sub={`${fmt(kpi.distinct_validators)} validators`}  tone='amber' />
        <KpiCard label='Worst validator'        value={categories[0]?.validator||'—'} sub={categories[0] ? pct(categories[0].pct)+' of failures' : ''} tone='coral' />
        <KpiCard label='Top error code'         value={errorCodes[0]?.dlr_code||'—'} sub={errorCodes[0] ? `${errorCodes[0].name} · ${fmt(errorCodes[0].cnt)}` : ''} tone='purple' />
      </div>

      {/* ── Trend + Category ── */}
      <SectionLabel tone='coral'>Distribution</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
        <Panel tone='coral' eyebrow='Failure trend over time'>
          <TrendChart data={trend} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.muted, fontFamily: 'monospace', marginTop: 6 }}>
            <span>bars = failure count per bucket</span>
            <span>total {fmt(kpi.failed)} failures</span>
          </div>
        </Panel>
        <Panel tone='coral' eyebrow='By validator — click to filter'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.slice(0, 6).map((c: any) => {
              const t = validatorTone(c.validator)
              return (
                <button key={c.validator}
                  onClick={() => setFilterCat(filterCat === c.validator ? '' : c.validator)}
                  style={{ textAlign: 'left', background: filterCat === c.validator ? BG[t] : 'transparent', borderRadius: 6, padding: '4px 6px', border: 'none', cursor: 'pointer', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.validator}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(c.cnt)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TXT[t], minWidth: 36, textAlign: 'right' }}>{pct(c.pct)}</span>
                    </div>
                  </div>
                  <Bar val={num(c.pct)} tone={t} height={4} />
                </button>
              )
            })}
            {categories.length === 0 && <div style={{ color: C.muted, fontSize: 12, fontFamily: 'monospace', textAlign: 'center', padding: '16px 0' }}>No failure data</div>}
          </div>
        </Panel>
      </div>

      {/* ── Error codes + Drilldown ── */}
      <SectionLabel tone='coral'>Error Codes — Click to drill</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 4 }}>
        <Panel tone='coral' eyebrow='Top error codes'
          actions={<button onClick={() => setSelected(null)} style={{ fontSize: 10.5, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: 'pointer', color: C.muted }}>Clear ⊗</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errorCodes.map((e: any) => {
              const t: Tone = severityTone(e.severity)
              const active = selected?.dlr_code === e.dlr_code
              return (
                <button key={e.dlr_code} onClick={() => setSelected(e)}
                  style={{ textAlign: 'left', width: '100%', border: active ? `1px solid ${BDR[t]}` : '1px solid transparent', cursor: 'pointer',
                    display: 'grid', gridTemplateColumns: '60px 1fr 80px 56px', alignItems: 'center', gap: 12,
                    padding: '9px 10px', borderRadius: 8, background: active ? BG[t] : 'transparent', transition: 'background 0.1s' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, background: BG[t], color: TXT[t], padding: '3px 6px', borderRadius: 5, textAlign: 'center' }}>{e.dlr_code}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{e.name}</div>
                    <div style={{ height: 3, background: 'hsl(var(--muted))', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(num(e.pct) * 2.5, 100)}%`, height: '100%', background: TXT[t], borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.muted, textAlign: 'right' }}>{fmt(e.cnt)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: BG[t], color: TXT[t], padding: '2px 8px', borderRadius: 4, textAlign: 'center', fontFamily: 'monospace' }}>{pct(e.pct)}</span>
                </button>
              )
            })}
            {errorCodes.length === 0 && (
              <div style={{ color: C.muted, fontSize: 12, padding: '20px 0', textAlign: 'center', fontFamily: 'monospace' }}>No failures in this window 🎉</div>
            )}
          </div>
        </Panel>
        <DrillPanel code={selected} affected={affected} />
      </div>

      {/* ── Three breakdown panels ── */}
      <SectionLabel tone='amber'>Failure Breakdown</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 4 }}>

        {/* By validation step */}
        <Panel tone='teal' eyebrow='By validation step'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {byStep.slice(0, 7).map((s: any, i: number) => {
              const t: Tone = i === 0 ? 'coral' : i < 3 ? 'amber' : 'teal'
              return (
                <div key={s.step}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: C.text, fontSize: 11 }}>{s.step}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{fmt(s.failed)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TXT[t] }}>{pct(s.fail_pct)}</span>
                    </div>
                  </div>
                  <Bar val={num(s.fail_pct)} tone={t} height={4} />
                </div>
              )
            })}
            {byStep.length === 0 && <div style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', paddingTop: 12 }}>No step data</div>}
          </div>
        </Panel>

        {/* By IP subnet */}
        <Panel tone='amber' eyebrow='By originator IP subnet'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {bySubnet.slice(0, 6).map((o: any, i: number) => {
              const t: Tone = i === 0 ? 'coral' : i < 3 ? 'amber' : 'teal'
              return (
                <div key={o.ip_subnet}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', color: C.text, fontSize: 11 }}>{o.ip_subnet || 'Unknown'}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.muted }}>{fmt(o.failed)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TXT[t] }}>{pct(o.fail_pct)}</span>
                    </div>
                  </div>
                  <Bar val={num(o.fail_pct)} tone={t} height={4} />
                </div>
              )
            })}
            {bySubnet.length === 0 && <div style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', paddingTop: 12 }}>No IP data (originator_ip may be empty)</div>}
          </div>
        </Panel>

        {/* By sender */}
        <Panel tone='purple' eyebrow='By sender — fail %'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {bySender.slice(0, 6).map((s: any) => {
              const t: Tone = num(s.fail_pct) > 70 ? 'coral' : num(s.fail_pct) > 40 ? 'amber' : 'purple'
              return (
                <div key={s.sender_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: C.text, fontSize: 11 }}>{s.sender_id}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.muted }}>{fmt(s.failed)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TXT[t] }}>{pct(s.fail_pct)}</span>
                    </div>
                  </div>
                  <Bar val={num(s.fail_pct)} tone={t} height={4} />
                </div>
              )
            })}
            {bySender.length === 0 && <div style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', paddingTop: 12 }}>No sender data</div>}
          </div>
        </Panel>
      </div>

      {/* ── Trace log ── */}
      <SectionLabel tone='coral'>Recent Failure Trace Log</SectionLabel>
      <Panel tone='coral' eyebrow='Last 50 failures'
        actions={<span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{traceLog.length} records</span>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>
                {['Time', 'Sender', 'PE ID', 'IP', 'Step', 'Code', 'Validator', 'Description'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontWeight: 500, padding: '6px 10px 8px 0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traceLog.map((row: any, i: number) => {
                const t: Tone = validatorTone(row.validator)
                return (
                  <tr key={i} style={{ borderTop: '1px solid hsl(var(--border))' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--surface-2))')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: C.muted, whiteSpace: 'nowrap' }}>{ts(row.timestamp)}</td>
                    <td style={{ padding: '8px 10px 8px 0', fontWeight: 600 }}>{row.sender_id || '—'}</td>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: C.muted, fontSize: 11 }}>{row.pe_id || '—'}</td>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: C.muted, fontSize: 11 }}>{row.originator_ip || '—'}</td>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{row.validation_step || '—'}</td>
                    <td style={{ padding: '8px 10px 8px 0' }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, background: BG[t], color: TXT[t], padding: '2px 7px', borderRadius: 4 }}>{row.dlr_code}</span>
                    </td>
                    <td style={{ padding: '8px 10px 8px 0', color: C.muted, fontFamily: 'monospace', fontSize: 11 }}>{row.validator || '—'}</td>
                    <td style={{ padding: '8px 0 8px 0', color: 'hsl(var(--foreground))', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                  </tr>
                )
              })}
              {traceLog.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>
                  {loading ? 'Loading…' : 'No failures in this window 🎉'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
