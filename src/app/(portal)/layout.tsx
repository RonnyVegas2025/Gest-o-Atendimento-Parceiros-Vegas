'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import GlobalSearch from '@/components/layout/GlobalSearch'
import { LogOut, User } from 'lucide-react'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email ?? '')

      // Busca nome do usuário pelo email
      const { data } = await supabase
        .from('users_profile')
        .select('full_name')
        .eq('email', user.email)
        .maybeSingle()

      if (data?.full_name) setUserName(data.full_name)
      else setUserName(user.email ?? '')
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1">
            <GlobalSearch />
          </div>

          {/* Usuário logado + logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#185FA5] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : <User size={12} />}
              </div>
              <span className="text-xs font-medium text-gray-700 hidden sm:block">
                {userName || userEmail}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={13} />
              <span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
