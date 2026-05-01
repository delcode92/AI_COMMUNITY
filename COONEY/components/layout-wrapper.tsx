'use client'

import { Sidebar } from './sidebar'
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context'

interface LayoutWrapperProps {
  children: React.ReactNode
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSidebar()

  return (
    <>
      <Sidebar />
      <main
        className={`flex-1 overflow-auto transition-all duration-300 ${
          isOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        {children}
      </main>
    </>
  )
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-white">
        <LayoutContent>{children}</LayoutContent>
      </div>
    </SidebarProvider>
  )
}
