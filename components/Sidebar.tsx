'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Nav items ─────────────────────────────────────────────────────────────────
const ITEMS = [
  { href: '/dashboard',  label: 'Overview',  icon: '⊞' },
  { href: '/users',      label: 'Users',     icon: '◎' },
  { href: '/failures',   label: 'Failures',  icon: '⚠' },
  { href: '/trace',      label: 'Trace',     icon: '≡' },
  { href: '/scrubbing',  label: 'Scrubbing', icon: '⊘' },
  { href: '/tps',        label: 'TPS',       icon: '⊛' },
  { href: '/mis',        label: 'MIS',       icon: '▤' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      position: 'sticky', top: 0, height: '100vh', width: 220, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border, #e5e7eb)',
      background: 'var(--bg-surface, #fff)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Brand */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', borderBottom: '1px solid var(--border, #e5e7eb)',
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(13,148,136,0.12)', color: '#0d9488', fontWeight: 800, fontSize: 15 }}>
          G
          <span style={{ position: 'absolute', right: -2, bottom: -2, width: 6, height: 6, borderRadius: '50%', background: '#0d9488' }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg, #111827)' }}>
          GoFlipo<span style={{ color: 'var(--fg-muted, #6b7280)', fontWeight: 400 }}>/Support</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 8, flex: 1 }}>
        {ITEMS.map(item => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, fontSize: 12,
              fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em',
              textDecoration: 'none', transition: 'all 0.12s',
              color: active ? 'var(--fg, #111827)' : 'var(--fg-muted, #6b7280)',
              background: active ? 'var(--bg-accent, #f3f4f6)' : 'transparent',
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-accent, #f3f4f6)'; (e.currentTarget as HTMLElement).style.color = 'var(--fg, #111827)' }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted, #6b7280)' }}}
            >
              {/* Active indicator bar */}
              {active && (
                <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: '0 2px 2px 0', background: '#0d9488' }} />
              )}
              <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border, #e5e7eb)', fontSize: 10, fontFamily: 'monospace', color: 'var(--fg-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        GoFlipo Support v2
      </div>
    </aside>
  )
}
