'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, Ticket, Plus,
  Users, BarChart3, Handshake, LogOut
} from 'lucide-react'

const navItems = [
  { label: 'Visão geral', items: [
    { href: '/dashboard',    label: 'Dashboard',        icon: LayoutDashboard },
  ]},
  { label: 'Operação', items: [
    { href: '/atendimentos/novo', label: 'Novo atendimento', icon: Plus },
    { href: '/atendimentos',     label: 'Atendimentos',      icon: Ticket },
  ]},
  { label: 'Cadastros', items: [
    { href: '/empresas',   label: 'Empresas',  icon: Building2 },
    { href: '/parceiros',  label: 'Parceiros', icon: Handshake },
  ]},
  { label: 'Admin', items: [
    { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { href: '/usuarios',   label: 'Usuários',   icon: Users },
  ]},
]

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  return (
    <aside className="w-[220px] min-w-[220px] bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#185FA5] flex items-center justify-center text-white text-sm font-bold">
            V
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">Vegas Card</div>
            <div className="text-xs text-gray-400">Portal Parceiros</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navItems.map(section => (
          <div key={section.label}>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = item.href === '/atendimentos'
                  ? pathname === '/atendimentos' || (pathname.startsWith('/atendimentos/') && pathname !== '/atendimentos/novo')
                  : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('nav-item', isActive && 'nav-item-active')}
                  >
                    <item.icon size={15} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-semibold">
            {profile?.full_name?.slice(0, 2).toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900 truncate">
              {profile?.full_name ?? 'Usuário'}
            </div>
            <div className="text-[10px] text-gray-400 truncate capitalize">
              {profile?.role?.replace('_', ' ') ?? ''}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="nav-item w-full text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </aside>
  )
}
