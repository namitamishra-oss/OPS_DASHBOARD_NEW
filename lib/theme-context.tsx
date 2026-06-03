'use client'

/*
 * lib/theme-context.tsx — NAYI FILE BANANI HAI
 *
 * Kya karta hai?
 * → Poori app ka theme state manage karta hai
 * → useTheme() hook expose karta hai — koi bhi component use kar sakta hai
 *
 * Kaise kaam karta hai?
 * → User theme choose karta hai (Light/Dark/System)
 * → localStorage mein save hota hai (page refresh ke baad bhi yaad rahe)
 * → document.documentElement pe data-theme="dark" ya "light" set hota hai
 * → globals.css mein [data-theme="dark"] ke variables activate ho jaate hain
 * → Poori app instantly theme change ho jaati hai
 *
 * Default: 'light' — pehli baar kholne par light theme
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode           // user ne kya select kiya
  resolved: ResolvedTheme   // actually kaunsa theme apply hua
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  resolved: 'light',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [resolved, setResolved] = useState<ResolvedTheme>('light')

  function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function applyTheme(r: ResolvedTheme) {
    // <html data-theme="dark"> set karo
    // globals.css mein [data-theme="dark"] variables activate honge
    document.documentElement.setAttribute('data-theme', r)
    setResolved(r)
  }

  // Page load pe localStorage se saved preference load karo
  useEffect(() => {
    const saved = (localStorage.getItem('ops-theme') as ThemeMode) || 'light'
    setModeState(saved)
    const r = saved === 'system' ? getSystemTheme() : saved
    applyTheme(r)
  }, [])

  // System theme change detect karo (agar user ne System select kiya hai)
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(getSystemTheme())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  function setMode(m: ThemeMode) {
    setModeState(m)
    const r = m === 'system' ? getSystemTheme() : m
    applyTheme(r)
    localStorage.setItem('ops-theme', m)
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Yeh hook components mein use karo:
// const { mode, resolved, setMode } = useTheme()
export const useTheme = () => useContext(ThemeContext)
