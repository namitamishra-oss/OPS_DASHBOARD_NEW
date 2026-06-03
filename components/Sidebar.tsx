'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV_ITEMS = [
  { label: 'OVERVIEW',  href: '/dashboard' },
  { label: 'USERS',     href: '/users'     },
  { label: 'FAILURES',  href: '/failures'  },
  { label: 'TRACE',     href: '/trace'     },
  { label: 'SCRUBBING', href: '/scrubbing' },
  { label: 'TPS',       href: '/tps'       },
  { label: 'MIS',       href: '/mis'       },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 160,
      minHeight: '100vh',
      background: '#1e2028',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 50,
      borderRight: '1px solid #2a2d38',
    }}>

      {/* Logo */}
      <div style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid #2a2d38',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28,
          background: '#1a9e8c',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff',
          flexShrink: 0,
        }}>G</div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#e2e4ea', lineHeight: 1.2 }}>GoFlipo</div>
          <div style={{ fontSize: 9, color: '#4a5068', letterSpacing: '0.08em' }}>SUPPORT OPS</div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '14px 16px 6px', fontSize: 9.5, color: '#3a3f52', letterSpacing: '0.1em', fontWeight: 600 }}>
        NAVIGATION
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 8px', gap: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 6,
                background: isActive ? '#1a9e8c15' : 'transparent',
                color: isActive ? '#1a9e8c' : '#8b91a8',
                textDecoration: 'none',
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '0.07em',
                transition: 'all 0.12s',
                borderLeft: isActive ? '2px solid #1a9e8c' : '2px solid transparent',
                paddingLeft: isActive ? 8 : 10,
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid #2a2d38' }}>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 6,
            background: 'none',
            border: 'none',
            color: '#4a5068',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.07em',
            textAlign: 'left',
          }}
        >
          SIGN OUT
        </button>
      </div>
    </aside>
  )
}
