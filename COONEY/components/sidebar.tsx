'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Home, Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/lib/sidebar-context'

export function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar()
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/skills', label: 'Skills', icon: Zap },
    { href: '/tools', label: 'Tools', icon: Settings },
  ]

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#2D3E50] text-white transition-all duration-300 z-40 ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1DD7C0]">
          <div className={`flex items-center gap-3 overflow-hidden ${!isOpen && 'hidden'}`}>
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
              <Image
                src="/cooney.png"
                alt="Cooney"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="whitespace-nowrap">
              <h1 className="font-bold text-lg">Cooney</h1>
              <p className="text-xs text-gray-400">Learning Buddy</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="text-white hover:bg-[#1DD7C0] hover:text-[#2D3E50]"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 px-3 py-2 my-1 rounded-md transition-colors ${
                      isActive
                        ? 'bg-[#1DD7C0] text-[#2D3E50] hover:bg-[#1DD7C0]'
                        : 'text-white hover:bg-[#1DD7C0] hover:text-[#2D3E50]'
                    } ${!isOpen && 'justify-center'}`}
                  >
                    <Icon size={20} />
                    {isOpen && <span className="font-medium">{item.label}</span>}
                  </Button>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t border-[#1DD7C0] text-center text-xs text-gray-400 ${!isOpen && 'text-[10px]'}`}>
          {isOpen ? 'v1.0' : '1.0'}
        </div>
      </div>
    </aside>
  )
}
