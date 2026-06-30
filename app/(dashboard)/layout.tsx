'use client'
// app/(dashboard)/layout.tsx
import { ReactNode } from 'react'
import Topbar, { DashboardControlsProvider } from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardControlsProvider>
      {/* Topbar is fixed at top — renders its own 48px spacer div */}
      <Topbar />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 48px)' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          padding: '24px',
          overflow: 'auto',
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          minWidth: 0,
        }}>
          {children}
        </main>
      </div>
    </DashboardControlsProvider>
  )
}
