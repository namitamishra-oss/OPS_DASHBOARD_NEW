'use client'
import { ReactNode } from 'react'
import Topbar, { DashboardControlsProvider } from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardControlsProvider>
      <div style={{ minHeight: '100vh', display: 'flex', width: '100%', background: 'var(--bg-page, #f9fafb)', color: 'var(--fg, #111827)' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Topbar />
          <main style={{ padding: '24px 28px', width: '100%', maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </main>
        </div>
      </div>
    </DashboardControlsProvider>
  )
}
