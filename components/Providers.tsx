'use client'

/**
 * components/Providers.tsx
 *
 * Kyun alag component?
 * → SessionProvider ek client component hai (browser mein chalta hai)
 * → Root layout.tsx server component hona chahiye (Next.js requirement)
 * → Solution: SessionProvider ko alag 'use client' component mein wrap karo
 *   aur layout mein use karo
 *
 * Yeh pattern Next.js App Router ka standard pattern hai.
 */

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
