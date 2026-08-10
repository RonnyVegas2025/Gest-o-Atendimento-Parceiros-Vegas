'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { VegasLogo } from '@/components/brand/VegasLogo'
import { Eye, EyeOff } from 'lucide-react'

const APP_VERSION = 'v0.1.0'
const SYSTEM_NAME = 'Gestão de Atendimento — Parceiros'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Lógica de autenticação inalterada — apenas a apresentação foi refeita.
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  const fieldClass =
    'w-full px-3 py-2.5 text-body rounded-[10px] bg-vg-surface text-vg-ink ' +
    'placeholder-vg-ink-secondary border border-vg-border-field ' +
    'focus:outline-none focus:ring-2 focus:ring-vg-brand-500 focus:border-vg-brand-500 transition-colors'

  return (
    <div className="min-h-screen flex flex-col bg-vg-bg">
      {/* Faixa de gradiente institucional (3px) no topo da tela */}
      <div className="h-[3px] w-full bg-vg-institucional" />

      <div className="flex flex-1 min-h-0">
        {/* Painel institucional (esquerda) — oculto no mobile */}
        <aside className="hidden lg:flex lg:w-1/2 xl:w-[45%] flex-col justify-between bg-vg-brand-800 text-white p-12">
          <VegasLogo variant="completa" size={44} priority className="brightness-0 invert" />

          <div className="max-w-md">
            <h1 className="font-display text-display-xl font-semibold leading-tight">
              {SYSTEM_NAME}
            </h1>
            <p className="mt-4 text-body text-white/70">
              Plataforma interna Vegas para registro e acompanhamento de atendimentos a parceiros.
            </p>
          </div>

          <div className="max-w-md text-caption leading-relaxed text-white/60">
            <p className="font-medium text-white/80">Uso interno e confidencial</p>
            <p className="mt-1">
              Acesso restrito a colaboradores autorizados. As informações tratadas neste sistema
              são confidenciais e de uso exclusivo interno da Vegas.
            </p>
          </div>
        </aside>

        {/* Área de autenticação (direita) — fundo claro */}
        <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <header className="mb-8">
              <VegasLogo variant="completa" size={40} priority />
              <h2 className="mt-6 font-display text-h1 font-semibold text-vg-ink">
                {SYSTEM_NAME}
              </h2>
              <p className="mt-1 text-body-sm text-vg-ink-secondary">
                Entre com suas credenciais para acessar o painel.
              </p>
            </header>

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              {/* E-mail */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-body-sm font-medium text-vg-ink">E-mail</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={fieldClass}
                  placeholder="seu@email.com.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {/* Senha com botão Mostrar */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-body-sm font-medium text-vg-ink">Senha</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className={fieldClass + ' pr-24'}
                    placeholder="Sua senha"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption font-medium text-vg-brand-500 hover:text-vg-brand-800 focus:outline-none focus:ring-2 focus:ring-vg-brand-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>

                {/* Mensagem de erro próxima ao campo */}
                {error && (
                  <p role="alert" className="mt-1 text-body-sm text-vg-danger-fg bg-vg-danger-bg px-3 py-2 rounded-[10px]">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-[10px] text-body font-medium bg-vg-brand-500 text-white hover:bg-vg-brand-800 focus:outline-none focus:ring-2 focus:ring-vg-brand-500 focus:ring-offset-2 transition-colors disabled:opacity-60"
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>

            {/* Versão no rodapé */}
            <p className="mt-10 text-center text-caption text-vg-ink-secondary">
              Vegas · {SYSTEM_NAME} · {APP_VERSION}
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
