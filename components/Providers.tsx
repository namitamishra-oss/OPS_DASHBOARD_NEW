'use client'

/*
 * components/Providers.tsx — EXISTING FILE, REPLACE KARO
 *
 * Kya karta hai?
 * → SessionProvider (NextAuth) + ThemeProvider dono yahan wrap hain
 * → app/layout.tsx mein sirf <Providers> lagana hoga
 *
 * Kyun alag component?
 * → app/layout.tsx server component hai
 * → SessionProvider aur ThemeProvider dono 'use client' chahiye
 * → Solution: inhe ek alag client component mein wrap karo
 */

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/lib/theme-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}
