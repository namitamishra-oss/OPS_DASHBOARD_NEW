'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDashboardControls } from '@/components/Topbar'

// ── Helpers ────────────────────────────────────────────────────────────────────
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
function tsLong(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) }
  catch { return '—' }
}
function formatPhone(p: string) {
  if (p && p.length === 12 && p.startsWith('91')) return p.slice(2)
  return p || '—'
}

// ── Design tokens ──────────────────────────────────────────────────────────────
type Tone = 'teal' | 'purple' | 'coral' | 'amber'
const TXT:  Record<Tone, string> = { teal: 'hsl(var(--teal-text))', purple: 'hsl(var(--purple-text))', coral: 'hsl(var(--coral-text))', amber: 'hsl(var(--amber-text))' }
const BG:   Record<Tone, string> = { teal: 'hsl(var(--teal-bg))', purple: 'hsl(var(--purple-bg))', coral: 'hsl(var(--coral-bg))', amber: 'hsl(var(--amber-bg))' }
const BDR:  Record<Tone, string> = { teal: 'hsl(var(--teal-border))', purple: 'hsl(var(--purple-border))', coral: 'hsl(var(--coral-border))', amber: 'hsl(var(--amber-border))' }
const C = { text: 'hsl(var(--foreground))', muted: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))', card: 'hsl(var(--surface-1))', bg: 'hsl(var(--surface-2))' }

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

// ── Primitives ─────────────────────────────────────────────────────────────────
function Pill({ children, tone }: { children: React.ReactNode; tone: Tone | 'success' | 'warning' | 'danger' }) {
  const map: Record<string, [string, string]> = {
    teal: [BG.teal, TXT.teal], purple: [BG.purple, TXT.purple],
    coral: [BG.coral, TXT.coral], amber: [BG.amber, TXT.amber],
    success: ['hsl(var(--teal-bg))', 'hsl(var(--teal-text))'],
    warning: ['hsl(var(--amber-bg))', 'hsl(var(--amber-text))'],
    danger:  ['hsl(var(--coral-bg))', 'hsl(var(--coral-text))'],
  }
  const [bg, color] = map[tone] ?? map.teal
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function Panel({ children, tone = 'teal', eyebrow, title, actions }: any) {
  return (
    <div style={{ background: C.card, border: `1px solid ${BDR[tone as Tone] ?? C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      {(eyebrow || title || actions) && (
        <div style={{ marginBottom: 16 }}>
          {eyebrow && <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: C.muted, marginBottom: 4 }}>{eyebrow}</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {title && <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>}
            {actions}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone: Tone }) {
  return (
    <div style={{ background: BG[tone], border: `1px solid ${BDR[tone]}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: TXT[tone], marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

function SectionLabel({ children, tone = 'teal' }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 10px', color: TXT[tone as Tone] ?? TXT.teal }}>
      <div style={{ height: 1, width: 28, background: 'currentColor', opacity: 0.4 }} />
      <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em' }}>{children}</span>
    </div>
  )
}

// ── User Detail Drawer ─────────────────────────────────────────────────────────
function UserDrawer({ user, onClose }: { user: any; onClose: () => void }) {
  const tone = roleTone(user.type)
  const statusOk = user.self_status === 'approved' || user.self_status === 'active'

  // Close on Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const fields = [
    { label: 'User ID',       value: user.id,          mono: true },
    { label: 'Full Name',     value: user.name || '—' },
    { label: 'Email',         value: user.email,        mono: true },
    { label: 'Phone',         value: formatPhone(user.phone) || '—', mono: true },
    { label: 'Role',          value: roleLabel(user.type) },
    { label: 'Self Status',   value: user.self_status || '—' },
    { label: 'CEIND Approval',value: user.ceind_status || '—' },
    { label: 'Registered',    value: tsLong(user.created_at) },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, backdropFilter: 'blur(2px)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'hsl(var(--surface-1))',
        borderLeft: `1px solid hsl(var(--border))`,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Drawer header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid hsl(var(--border))`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: TXT[tone], marginBottom: 6 }}>
              User Profile
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              {user.name || user.email || '—'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill tone={tone}>{user.type?.toUpperCase()}</Pill>
              <Pill tone={statusOk ? 'success' : 'warning'}>{user.self_status || 'unknown'}</Pill>
              {user.ceind_status && (
                <Pill tone={user.ceind_status === 'approved' ? 'success' : 'warning'}>{user.ceind_status}</Pill>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'hsl(var(--accent))', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* All fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
            {fields.map(f => (
              <div key={f.label} style={{ padding: '11px 0', borderBottom: `1px solid hsl(var(--border))` }}>
                <div style={{ fontSize: 9.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.muted, marginBottom: 4 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 13, fontFamily: (f as any).mono ? 'monospace' : 'inherit', color: C.text, wordBreak: 'break-all', fontWeight: 500 }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.18em', color: C.muted, marginBottom: 12 }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* View in Trace */}
              <a
                href={`/trace?search=${encodeURIComponent(user.id)}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: BG.teal, border: `1px solid ${BDR.teal}`, borderRadius: 9, textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TXT.teal }}>View Trace Log</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>All submissions for this PE ID</div>
                </div>
                <span style={{ fontSize: 16, color: TXT.teal }}>→</span>
              </a>

              {/* View in MIS */}
              <a
                href={`/mis?search=${encodeURIComponent(user.id)}&dim=pe_id`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: BG.purple, border: `1px solid ${BDR.purple}`, borderRadius: 9, textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TXT.purple }}>View in MIS Reports</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Traffic breakdown by PE ID</div>
                </div>
                <span style={{ fontSize: 16, color: TXT.purple }}>→</span>
              </a>

              {/* View Failures */}
              <a
                href={`/failures?search=${encodeURIComponent(user.name || user.email)}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: BG.coral, border: `1px solid ${BDR.coral}`, borderRadius: 9, textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TXT.coral }}>View Failures</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Blocked submissions for this user</div>
                </div>
                <span style={{ fontSize: 16, color: TXT.coral }}>→</span>
              </a>

            </div>
          </div>

          {/* Copy ID */}
          <button
            onClick={() => navigator.clipboard.writeText(user.id)}
            style={{ marginTop: 16, width: '100%', padding: '9px', background: 'hsl(var(--accent))', border: `1px solid hsl(var(--border))`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace', color: C.muted, letterSpacing: '0.05em' }}
          >
            Copy User ID to clipboard
          </button>
        </div>

        {/* Drawer footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid hsl(var(--border))`, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', background: 'hsl(var(--muted))', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Users() {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page,    setPage]    = useState(1)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) p.set('search', search)
      if (typeFilter) p.set('type', typeFilter)
      const res = await fetch(`/api/users?${p}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [search, typeFilter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, typeFilter])

  const users      = data?.users      ?? []
  const total      = data?.total      ?? 0
  const roleCounts = data?.roleCounts ?? []
  const activity   = data?.activity   ?? []
  const totalPages = Math.ceil(total / 50)

  const roleCountMap: Record<string, number> = {}
  roleCounts.forEach((r: any) => { roleCountMap[r.type] = r.count })

  const inputStyle: React.CSSProperties = {
    background: 'hsl(var(--input-bg))', border: '1.5px solid hsl(var(--input-border))',
    borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'hsl(var(--input-text))',
    fontFamily: 'inherit', outline: 'none',
  }

  const openUser = (u: any) => setSelectedUser(u)
  const closeUser = () => setSelectedUser(null)

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 32 }}>

      {/* Detail drawer */}
      {selectedUser && <UserDrawer user={selectedUser} onClose={closeUser} />}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: TXT.teal, marginBottom: 5 }}>GoFlipo Support</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>Users</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Entities, senders, and access providers in the chain</p>
      </div>

      {error && <div style={{ background: BG.coral, border: `1px solid ${BDR.coral}`, borderRadius: 10, padding: 14, color: TXT.coral, fontFamily: 'monospace', fontSize: 12, marginBottom: 16 }}>⚠ {error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        <KpiCard label="Total users"  value={fmt(total)} tone="teal" />
        <KpiCard label="PE entities"  value={fmt(roleCountMap['pe'] ?? 0)} tone="purple" />
        <KpiCard label="Telemarketers" value={fmt(roleCountMap['tm'] ?? 0)} tone="teal" />
        <KpiCard label="Operators"     value={fmt(roleCountMap['op'] ?? 0)} tone="coral" />
        <KpiCard label="Others"        value={fmt((roleCountMap['ou'] ?? 0) + (roleCountMap['cu'] ?? 0) + (roleCountMap['ca'] ?? 0))} tone="amber" />
      </div>

      {/* Search + filter */}
      <Panel tone="teal" eyebrow="Search" title="Find a user">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            placeholder="Search name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.15)' }}
            onBlur={e =>  { e.currentTarget.style.borderColor = 'hsl(var(--input-border))'; e.currentTarget.style.boxShadow = 'none' }}
          />
          <select style={inputStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All roles</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(search || typeFilter) && (
            <button onClick={() => { setSearch(''); setTypeFilter('') }}
              style={{ padding: '7px 14px', background: 'hsl(var(--accent))', border: `1px solid hsl(var(--border))`, borderRadius: 8, cursor: 'pointer', fontSize: 12, color: C.muted }}>
              ✕ Clear
            </button>
          )}
        </div>
      </Panel>

      {/* Users table */}
      <SectionLabel tone="purple">All users · {total} total</SectionLabel>
      <Panel tone="purple" eyebrow="Directory" title="User accounts">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>
                {['#userId', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Approval', 'Registered', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontWeight: 500, padding: '6px 10px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const t = roleTone(u.type)
                const statusOk = u.self_status === 'approved' || u.self_status === 'active'
                return (
                  <tr key={u.id}
                    style={{ borderTop: `1px solid hsl(var(--border))`, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--surface-2))')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 10px 9px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted }}>{u.id}</td>
                    <td style={{ padding: '9px 10px 9px 0', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</td>
                    <td style={{ padding: '9px 10px 9px 0', color: C.muted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10.5 }}>{u.email}</td>
                    <td style={{ padding: '9px 10px 9px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap' }}>{formatPhone(u.phone)}</td>
                    <td style={{ padding: '9px 10px 9px 0' }}><Pill tone={t}>{u.type?.toUpperCase()}</Pill></td>
                    <td style={{ padding: '9px 10px 9px 0' }}><Pill tone={statusOk ? 'success' : 'warning'}>{u.self_status || '—'}</Pill></td>
                    <td style={{ padding: '9px 10px 9px 0' }}>
                      {u.ceind_status
                        ? <Pill tone={u.ceind_status === 'approved' ? 'success' : 'warning'}>{u.ceind_status}</Pill>
                        : <span style={{ color: C.border }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 10px 9px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap' }}>{ts(u.created_at)}</td>
                    {/* OPEN button — now functional */}
                    <td style={{ padding: '9px 0' }}>
                      <button
                        onClick={() => openUser(u)}
                        style={{ background: 'hsl(var(--teal-bg))', border: `1px solid hsl(var(--teal-border))`, borderRadius: 6, padding: '3px 10px', fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: TXT.teal, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        Open →
                      </button>
                    </td>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `1px solid hsl(var(--border))`, fontSize: 12 }}>
            <span style={{ fontFamily: 'monospace', color: C.muted }}>Page {page} of {totalPages} · {total} users</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={{ padding: '4px 12px', background: 'hsl(var(--surface-2))', border: `1px solid hsl(var(--border))`, borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 12, color: C.muted }}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                style={{ padding: '4px 12px', background: 'hsl(var(--surface-2))', border: `1px solid hsl(var(--border))`, borderRadius: 6, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontSize: 12, color: C.muted }}>Next →</button>
            </div>
          </div>
        )}
      </Panel>

      {/* Recent activity */}
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
                  <tr key={a.id}
                    style={{ borderTop: `1px solid hsl(var(--border))`, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--surface-2))')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted }}>{a.id}</td>
                    <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap' }}>{ts(a.ts)}</td>
                    <td style={{ padding: '8px 10px 8px 0' }}><Pill tone={t}>{a.type?.toUpperCase()}</Pill></td>
                    <td style={{ padding: '8px 10px 8px 0', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || '—'}</td>
                    <td style={{ padding: '8px 10px 8px 0', color: C.muted, fontFamily: 'monospace', fontSize: 10.5, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</td>
                    <td style={{ padding: '8px 10px 8px 0' }}><Pill tone={statusOk ? 'success' : 'warning'}>{a.self_status || '—'}</Pill></td>
                    <td style={{ padding: '8px 0' }}>
                      <button
                        onClick={() => openUser(a)}
                        style={{ background: 'hsl(var(--teal-bg))', border: `1px solid hsl(var(--teal-border))`, borderRadius: 6, padding: '3px 10px', fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: TXT.teal, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        Open →
                      </button>
                    </td>
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
