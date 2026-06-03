'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/lib/theme-context'

const NAV_ITEMS = [
  { label: 'OVERVIEW',  href: '/dashboard' },
  { label: 'USERS',     href: '/users'     },
  { label: 'FAILURES',  href: '/failures'  },
  { label: 'TRACE',     href: '/trace'     },
  { label: 'SCRUBBING', href: '/scrubbing' },
  { label: 'TPS',       href: '/tps'       },
  { label: 'MIS',       href: '/mis'       },
]

const THEME_OPTIONS = [
  { value: 'light'  as const, icon: '☀️', label: 'Light'  },
  { value: 'dark'   as const, icon: '🌙', label: 'Dark'   },
  { value: 'system' as const, icon: '💻', label: 'System' },
]

export default function Topbar() {
  const pathname = usePathname()
  const { mode, resolved, setMode } = useTheme()
  const [time, setTime]             = useState('')
  const [showTheme, setShowTheme]   = useState(false)
  const themeRef = useRef<HTMLDivElement>(null)
  const today = new Date().toLocaleDateString('en-CA')

  useEffect(() => {
    const tick = () => setTime(
      new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
    )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node))
        setShowTheme(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const themeIcon = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '💻'

  // Theme ke hisaab se colors — inline styles use karo
  // Kyun inline? Kyunki CSS variables theme switch pe turat update nahi hote
  // resolved = 'light' ya 'dark' — actual applied theme
  const isDark = resolved === 'dark'

  const colors = {
    navBg:       isDark ? '#0d0f14'   : '#111318',
    navBorder:   isDark ? '#1a1d28'   : '#1e2230',
    navText:     isDark ? '#c0c4d8'   : '#d0d3e0',   // clearly visible
    navMuted:    isDark ? '#545870'   : '#7a7f96',   // slightly muted
    navActive:   '#1db99f',                           // teal — same in both
    inputBg:     isDark ? '#07090e'   : '#0a0d15',
    inputBorder: isDark ? '#1a1d28'   : '#1e2230',
    dropBg:      isDark ? '#1c1f2a'   : '#ffffff',
    dropBorder:  isDark ? '#2a2d3e'   : '#e5e7eb',
    dropText:    isDark ? '#e8eaf2'   : '#111318',
    dropMuted:   isDark ? '#6b7080'   : '#9ca3af',
  }

  return (
    <>
      <header style={{
        height: 48,
        background: colors.navBg,
        borderBottom: `1px solid ${colors.navBorder}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 50,
        gap: 0,
      }}>

        {/* ── Brand ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          paddingRight: 20, marginRight: 8,
          borderRight: `1px solid ${colors.navBorder}`,
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
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: colors.navText,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            GoFlipo<span style={{ color: colors.navMuted, fontWeight: 400 }}>/</span>Support
          </span>
        </div>

        {/* ── Nav links — spacing fix ── */}
        {/*
          SPACING FIX:
          Pehle gap: 0 tha aur padding nahi tha → sab merge ho rahe the
          Ab har link ko padding: '0 14px' diya → proper spacing
        */}
        <nav style={{
          display: 'flex',
          alignItems: 'stretch',
          height: 48,
          flex: 1,
          gap: 0,        // gap 0 rakho — padding from each link
        }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',          // ← yeh tha missing! har item ko alag space
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.06em',
                  color: isActive ? colors.navActive : colors.navMuted,
                  textDecoration: 'none',
                  borderBottom: isActive ? `2px solid ${colors.navActive}` : '2px solid transparent',
                  borderTop: '2px solid transparent',
                  transition: 'color 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ── Right side ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)',
              color: colors.navMuted, fontSize: 14, pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="text"
              placeholder="Find user / sender / msgId"
              style={{
                height: 30, width: 210,
                background: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 6,
                padding: '0 10px 0 28px',
                fontSize: 11.5,
                color: colors.navMuted,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: colors.navBorder, margin: '0 2px' }} />

          {/* Live dot + time + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
            <span className="pulse" style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#1a9e8c', display: 'inline-block',
            }} />
            <span style={{ fontSize: 11.5, color: colors.navText, fontFamily: 'monospace' }}>
              {time}
            </span>
            <span style={{ fontSize: 11.5, color: colors.navMuted }}>·</span>
            <span style={{ fontSize: 11.5, color: colors.navMuted }}>{today}</span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: colors.navBorder, margin: '0 2px' }} />

          {/* Theme picker */}
          <div ref={themeRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTheme(v => !v)}
              title="Change theme"
              style={{
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 16,
                padding: '4px 6px', borderRadius: 5,
                lineHeight: 1,
              }}
            >{themeIcon}</button>

            {showTheme && (
              <div style={{
                position: 'absolute', top: 40, right: 0,
                background: colors.dropBg,
                border: `1px solid ${colors.dropBorder}`,
                borderRadius: 10, padding: 6,
                minWidth: 148,
                boxShadow: isDark
                  ? '0 8px 24px rgba(0,0,0,0.5)'
                  : '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 100,
              }}>
                <p style={{
                  fontSize: 9.5, fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: colors.dropMuted,
                  padding: '4px 10px 6px',
                }}>APPEARANCE</p>

                {THEME_OPTIONS.map(opt => {
                  const isSelected = mode === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setMode(opt.value); setShowTheme(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        width: '100%', padding: '7px 10px',
                        borderRadius: 7, border: 'none',
                        background: isSelected ? 'rgba(26,158,140,0.12)' : 'transparent',
                        color: isSelected ? '#1a9e8c' : colors.dropText,
                        cursor: 'pointer', fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{opt.icon}</span>
                      <span style={{ flex: 1 }}>{opt.label}</span>
                      {isSelected && (
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#1a9e8c',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff', flexShrink: 0,
                        }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: colors.navBorder, margin: '0 2px' }} />

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600,
              letterSpacing: '0.07em',
              color: colors.navMuted,
              padding: '4px 8px', borderRadius: 4,
            }}
          >SIGN OUT</button>

        </div>
      </header>

      {/* Spacer — content 48px topbar ke neeche start ho */}
      <div style={{ height: 48 }} />
    </>
  )
}
