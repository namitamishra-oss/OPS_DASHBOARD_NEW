'use client'
import { ReactNode } from 'react'
import Topbar from '@/components/Topbar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Topbar />
      <main style={{ padding: '20px 24px' }}>
        {children}
      </main>
    </div>
  )
}
