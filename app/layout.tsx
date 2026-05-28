/**
 * app/layout.tsx — ROOT LAYOUT
 *
 * SessionProvider wrap karta hai poori app ko.
 * Iske bina useSession() hook kaam nahi karega kisi bhi component mein.
 *
 * Google fonts yahan load hote hain — DM Sans
 * (matches the clean sans-serif look in the designs)
 */

import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { Providers } from '@/components/Providers'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'GoFlipo/Support — Internal Operations Console',
  description: 'Real-time delivery, scrubbing & latency telemetry',
  // Prevent indexing — internal tool
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {/* Providers = SessionProvider wrapper (client component) */}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
