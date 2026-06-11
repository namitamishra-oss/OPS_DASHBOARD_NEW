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
function ts(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) }
  catch { return '—' }
}
function formatPhone(p: string) {
  if (p && p.length === 12 && p.startsWith('91')) return p.slice(2)
  return p || '—'
}

// ── Design tokens ─────────────────────────────────────────────────────────────
type Tone = 'teal' | 'purple' | 'coral' | 'amber'
const TXT:  Record<Tone, string> = { teal: '#0d9488', purple: '#7c3aed', coral: '#ef4444', amber: '#d97706' }
const BG:   Record<Tone, string> = { teal: '#f0fdfa', purple: '#faf5ff', coral: '#fef2f2', amber: '#fff7ed' }
const BDR:  Record<Tone, string> = { teal: '#99f6e4', purple: '#d8b4fe', coral: '#fca5a5', amber: '#fed7aa' }

// Role → tone mapping
const ROLES: Record<string, { label: string; tone: Tone }> = {
  pe:  { label: 'Principle Entity',   tone: 'purple' },
  tm:  { label: 'Telemarketer',       tone: 'teal'   },
  oa:  { label: 'Origination Access', tone: 'teal'   },
  op:  { label: 'Operator',           tone: 'coral'  },
  ou:  { label: 'OU User',            tone: 'amber'  },
  cu:  { label: 'Customer User',      tone: 'amber'  },
  ca:  { label: 'Company Admin',      tone: 'purple' },
}
function roleTone(type: string): Tone { return ROLES[type]?.tone ?? 'teal' }
function roleLabel(type: string): string { return ROLES[type]?.label ?? type?.toUpperCase() }

// ── Primitives ────────────────────────────────────────────────────────────────
function Pill({ children, tone }: { children: React.ReactNode; tone: Tone | 'success' | 'warning' | 'danger' }) {
  const map: Record<string, [string, string]> = {
    teal: [BG.teal, TXT.teal], purple: [BG.purple, TXT.purple],
    coral: [BG.coral, TXT.coral], amber: [BG.amber, TXT.amber],
    success: ['#dcfce7', '#166534'], warning: ['#fff7ed', '#92400e'], danger: ['#fee2e2', '#991b1b'],
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
    <div style={{ height, background: '#f3f4f6', borderRadius: height / 2, overflow: 'hidden', flex: 1, minWidth: 40 }}>
      <div style={{ width: `${Math.min(val, 100)}%`, height: '100%', background: TXT[tone], borderRadius: height / 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function Panel({ children, tone, eyebrow, title, actions, style }: {
  children: React.ReactNode; tone: Tone; eyebrow?: string; title?: string
  actions?: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', borderTop: `3px solid ${TXT[tone]}`, overflow: 'hidden', ...style }}>
      {(eyebrow || title || actions) && (
        <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            {eyebrow && <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: TXT[tone], marginBottom: 2 }}>{eyebrow}</div>}
            {title   && <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

function Kpi({ label, value, delta, tone }: { label: string; value: React.ReactNode; delta?: string; tone: Tone }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderTop: `3px solid ${TXT[tone]}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: TXT[tone], lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      {delta && <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{delta}</div>}
    </div>
  )
}

function SectionLabel({ tone = 'teal', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
      <div style={{ height: 1, width: 24, background: TXT[tone] }} />
      <span style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#6b7280' }}>{children}</span>
    </div>
  )
}

// ── Stacked bar ───────────────────────────────────────────────────────────────
function StackedBar({ segments, height = 12 }: { segments: { tone: Tone; pct: number; label: string }[]; height?: number }) {
  return (
    <div style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', gap: 1 }}>
      {segments.map(s => (
        <div key={s.label} style={{ width: `${s.pct}%`, height: '100%', background: TXT[s.tone], transition: 'width 0.5s ease' }}
          title={`${s.label}: ${s.pct.toFixed(1)}%`} />
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function UsersPage() {
  const { refreshTick } = useDashboardControls()

  const [data,        setData]        = useState<any>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('')
  const [page,        setPage]        = useState(1)
  const [searchInput, setSearchInput] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search)     params.set('search', search)
      if (typeFilter) params.set('type',   typeFilter)
      const res  = await fetch(`/api/users?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setData(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [refreshTick, page, search, typeFilter])

  // ── Derived ──────────────────────────────────────────────────────────────
  const users      = data?.users      ?? []
  const total      = data?.total      ?? 0
  const roleCounts = data?.roleCounts ?? []
  const newUsers   = data?.newUsers7d ?? []
  const activity   = data?.activity   ?? []

  const totalUsers   = roleCounts.reduce((s: number, r: any) => s + num(r.count), 0) || total
  const peCount      = roleCounts.find((r: any) => r.type === 'pe')?.count ?? 0
  const tmCount      = roleCounts.filter((r: any) => ['tm', 'tma', 'tmd'].includes(r.type)).reduce((s: number, r: any) => s + num(r.count), 0)
  const apCount      = roleCounts.filter((r: any) => ['oa', 'op', 'ou'].includes(r.type)).reduce((s: number, r: any) => s + num(r.count), 0)
  const newTotal7d   = newUsers.reduce((s: number, u: any) => s + num(u.count), 0)

  const stackSegments = roleCounts.map((r: any) => ({
    tone: roleTone(r.type), pct: totalUsers > 0 ? (num(r.count) / totalUsers) * 100 : 0, label: r.type?.toUpperCase(),
  }))

  const totalPages = Math.ceil(total / 50)
  const C = { text: '#111827', muted: '#6b7280', border: '#e5e7eb', card: '#fff' }

  const applySearch = () => { setSearch(searchInput); setPage(1) }

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', fontSize: 13, color: C.text }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: TXT.teal, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>GoFlipo Support</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Users</h1>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Entities, senders, and access providers in the chain</div>
          </div>
          {loading && <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>Loading…</span>}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 12, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>⚠ {error}</div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ background: C.card, border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          style={{ fontSize: 11.5, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontFamily: 'monospace', cursor: 'pointer' }}>
          <option value=''>All roles</option>
          {Object.entries(ROLES).map(([code, r]) => <option key={code} value={code}>{code.toUpperCase()} · {r.label}</option>)}
        </select>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applySearch()}
          placeholder="Search by ID / name / email…"
          style={{ flex: 1, minWidth: 200, fontSize: 11.5, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={applySearch}
          style={{ fontSize: 11.5, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: 'none', background: TXT.teal, color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
          Apply
        </button>
        {(search || typeFilter) && (
          <button onClick={() => { setSearch(''); setSearchInput(''); setTypeFilter(''); setPage(1) }}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid #e5e7eb', background: C.card, color: C.muted, fontFamily: 'monospace' }}>
            Clear ✕
          </button>
        )}
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <Kpi tone="teal"   label="Total users"         value={fmt(totalUsers || total)}  delta="across all roles" />
        <Kpi tone="coral"  label="Principle entities"  value={fmt(peCount)}  delta={totalUsers ? `${((peCount/totalUsers)*100).toFixed(1)}% of chain` : ''} />
        <Kpi tone="purple" label="Telemarketers"       value={fmt(tmCount)}  delta="TM + TMA + TMD" />
        <Kpi tone="amber"  label="Access providers"    value={fmt(apCount)}  delta="OA + OP + OU" />
      </div>

      {/* ── Role distribution ── */}
      <Panel tone="purple" eyebrow="Distribution" title="Role distribution across the chain" style={{ marginBottom: 16 }}>
        <StackedBar segments={stackSegments} height={14} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginTop: 14 }}>
          {roleCounts.map((r: any) => {
            const t = roleTone(r.type)
            const p = totalUsers > 0 ? ((num(r.count) / totalUsers) * 100).toFixed(1) : '0'
            const active = typeFilter === r.type
            return (
              <button key={r.type}
                onClick={() => setTypeFilter(active ? '' : r.type)}
                style={{ textAlign: 'left', borderRadius: 8, border: `1px solid ${active ? TXT[t] : '#e5e7eb'}`, padding: '10px 10px', cursor: 'pointer', background: active ? BG[t] : C.card, transition: 'all 0.12s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Pill tone={t}>{r.type?.toUpperCase()}</Pill>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{p}%</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4, marginBottom: 4 }}>{roleLabel(r.type)}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(r.count)}</div>
              </button>
            )
          })}
        </div>
      </Panel>

      {/* ── Roles breakdown + Top accounts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Panel tone="coral" eyebrow="Roles" title="Roles breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {roleCounts.map((r: any) => {
              const t = roleTone(r.type)
              const p = totalUsers > 0 ? (num(r.count) / totalUsers) * 100 : 0
              return (
                <button key={r.type}
                  onClick={() => setTypeFilter(typeFilter === r.type ? '' : r.type)}
                  style={{ display: 'grid', gridTemplateColumns: '56px 1fr 60px 90px 52px', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: typeFilter === r.type ? BG[t] : 'transparent', textAlign: 'left', fontSize: 12, width: '100%' }}>
                  <Pill tone={t}>{r.type?.toUpperCase()}</Pill>
                  <span style={{ color: C.muted }}>{roleLabel(r.type)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: C.text, fontWeight: 600 }}>{fmt(r.count)}</span>
                  <Bar val={p} tone={t} height={4} />
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: TXT[t], fontWeight: 700, fontSize: 11 }}>{p.toFixed(1)}%</span>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel tone="amber" eyebrow="7 days" title="New registrations">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {newUsers.map((u: any) => {
              const t = roleTone(u.type)
              return (
                <div key={u.type} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <Pill tone={t}>{u.type?.toUpperCase()}</Pill>
                  <span style={{ flex: 1, color: C.muted }}>{roleLabel(u.type)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{fmt(u.count)}</span>
                </div>
              )
            })}
            {newUsers.length === 0 && <div style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}>No new users in 7 days</div>}
            <div style={{ paddingTop: 10, marginTop: 4, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <span style={{ color: C.muted }}>Total new (7d)</span>
              <span style={{ color: TXT.amber, fontWeight: 700 }}>+{newTotal7d}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Users table ── */}
      <SectionLabel tone="teal">User list · {fmt(total)} records</SectionLabel>
      <Panel tone="teal" eyebrow="Accounts from production DB"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: page <= 1 ? 'default' : 'pointer', border: '1px solid #e5e7eb', background: '#f9fafb', color: page <= 1 ? '#d1d5db' : C.muted, fontFamily: 'monospace' }}>← Prev</button>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{page} / {totalPages || 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: page >= totalPages ? 'default' : 'pointer', border: '1px solid #e5e7eb', background: '#f9fafb', color: page >= totalPages ? '#d1d5db' : C.muted, fontFamily: 'monospace' }}>Next →</button>
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>
                {['#userId', 'Name', 'Email', 'Phone', 'Role', 'Status', 'CEIND', 'Joined', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontWeight: 500, padding: '6px 10px 8px 0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const t = roleTone(u.type)
                const statusOk = u.self_status === 'approved' || u.self_status === 'active'
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '9px 10px 9px 0', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{u.id}</td>
                    <td style={{ padding: '9px 10px 9px 0', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</td>
                    <td style={{ padding: '9px 10px 9px 0', color: C.muted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{u.email}</td>
                    <td style={{ padding: '9px 10px 9px 0', fontFamily: 'monospace', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{formatPhone(u.phone)}</td>
                    <td style={{ padding: '9px 10px 9px 0' }}><Pill tone={t}>{u.type?.toUpperCase()}</Pill></td>
                    <td style={{ padding: '9px 10px 9px 0' }}><Pill tone={statusOk ? 'success' : 'warning'}>{u.self_status || '—'}</Pill></td>
                    <td style={{ padding: '9px 10px 9px 0' }}>{u.ceind_status ? <Pill tone={u.ceind_status === 'approved' ? 'success' : 'warning'}>{u.ceind_status}</Pill> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '9px 10px 9px 0', fontFamily: 'monospace', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{ts(u.created_at)}</td>
                    <td style={{ padding: '9px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em' }}>open →</td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>
                  {loading ? 'Loading…' : 'No users found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Recent activity ── */}
      <SectionLabel tone="teal">Recent activity · latest updated accounts</SectionLabel>
      <Panel tone="teal" eyebrow="Audit" title="Recent user activity"
        actions={<span style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{activity.length} events</span>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>
                {['#userId', 'Timestamp', 'Role', 'Name', 'Email', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontWeight: 500, padding: '6px 10px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.map((a: any) => {
                const t = roleTone(a.type)
                const statusOk = a.self_status === 'approved' || a.self_status === 'active'
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{a.id}</td>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{ts(a.ts)}</td>
                    <td style={{ padding: '8px 10px 8px 0' }}><Pill tone={t}>{a.type?.toUpperCase()}</Pill></td>
                    <td style={{ padding: '8px 10px 8px 0', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || '—'}</td>
                    <td style={{ padding: '8px 10px 8px 0', color: C.muted, fontFamily: 'monospace', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</td>
                    <td style={{ padding: '8px 10px 8px 0' }}><Pill tone={statusOk ? 'success' : 'warning'}>{a.self_status || '—'}</Pill></td>
                    <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em' }}>open →</td>
                  </tr>
                )
              })}
              {activity.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>
                  {loading ? 'Loading…' : 'No activity data'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  )
}
