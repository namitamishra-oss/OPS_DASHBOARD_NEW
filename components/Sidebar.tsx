'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Nav items — Trace/Scrubbing merged into one ────────────────────────────────
const ITEMS = [
  { href: '/dashboard', label: 'Overview',          icon: '⊞' },
  { href: '/users',     label: 'Users',             icon: '◎' },
  { href: '/failures',  label: 'Failures',          icon: '⚠' },
  { href: '/trace',     label: 'Trace / Scrubbing', icon: '≡' },
  { href: '/tps',       label: 'TPS',               icon: '⊛' },
  { href: '/mis',       label: 'MIS',               icon: '▤' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      position: 'sticky', top: 0, height: '100vh', width: 220, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid hsl(var(--border))',
      background: 'hsl(var(--card))',
    }}>
      {/*
        ── NO BRAND HERE ─────────────────────────────────────────────────────────
        Brand (GoFlipo/Support) lives only in the Topbar.
        This sidebar top area is just a spacer that aligns with the 48px topbar.
      */}
      <div style={{
        height: 48, flexShrink: 0,
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex', alignItems: 'center', padding: '0 16px',
      }}>
        <span style={{
          fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase',
          letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))',
        }}>
          Navigation
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 8, flex: 1, overflowY: 'auto' }}>
        {ITEMS.map(item => {
          const active =
            path === item.href ||
            (item.href !== '/dashboard' && path.startsWith(item.href + '/')) ||
            (item.href === '/trace' && (path.startsWith('/trace') || path.startsWith('/scrubbing')))

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                fontSize: 12, fontFamily: 'monospace',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                textDecoration: 'none', transition: 'background 0.12s, color 0.12s',
                color: active
                  ? 'hsl(var(--foreground))'
                  : 'hsl(var(--muted-foreground))',
                background: active
                  ? 'hsl(var(--accent))'
                  : 'transparent',
                fontWeight: active ? 600 : 400,
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: 6, bottom: 6,
                  width: 3, borderRadius: '0 2px 2px 0',
                  background: 'hsl(var(--primary))',
                }} />
              )}
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid hsl(var(--border))',
        fontSize: 10, fontFamily: 'monospace',
        color: 'hsl(var(--muted-foreground))',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        GoFlipo Support v2
      </div>
    </aside>
  )
}
