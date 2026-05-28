'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, X, Ticket, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Result {
  id: string
  type: 'ticket' | 'company'
  title: string
  subtitle: string
  href: string
  status?: string
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-amber-50 text-amber-600', aberto: 'bg-blue-50 text-blue-700',
  em_analise: 'bg-amber-50 text-amber-700', em_andamento: 'bg-green-50 text-green-700',
  encaminhado: 'bg-purple-50 text-purple-700', aguardando_retorno: 'bg-gray-100 text-gray-600',
  finalizado: 'bg-green-100 text-green-800', cancelado: 'bg-red-50 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', aberto: 'Aberto', em_analise: 'Em analise',
  em_andamento: 'Em andamento', encaminhado: 'Encaminhado',
  aguardando_retorno: 'Aguardando', finalizado: 'Finalizado', cancelado: 'Cancelado',
}

// Normaliza CNPJ removendo formatação para comparar
function normalizeCnpj(v: string) {
  return v.replace(/\D/g, '')
}

// Monta filtro OR para busca inteligente
function buildSearchFilter(q: string): string {
  const digits = normalizeCnpj(q)
  const filters: string[] = [
    `protocol.ilike.%${q}%`,
    `company_legal_name.ilike.%${q}%`,
    `company_name_free.ilike.%${q}%`,
    `requester_name.ilike.%${q}%`,
    `employee_name.ilike.%${q}%`,
    `type_name.ilike.%${q}%`,
  ]
  // Se parece com CNPJ (só dígitos >= 3), busca sem formatação
  if (digits.length >= 3) {
    filters.push(`company_cnpj.ilike.%${digits}%`)
  }
  return filters.join(',')
}

function buildCompanyFilter(q: string): string {
  const digits = normalizeCnpj(q)
  const filters: string[] = [
    `legal_name.ilike.%${q}%`,
    `trade_name.ilike.%${q}%`,
    `nome_fantasia.ilike.%${q}%`,
    `razao_social.ilike.%${q}%`,
  ]
  if (digits.length >= 3) {
    filters.push(`cnpj.ilike.%${digits}%`)
  }
  return filters.join(',')
}

export default function GlobalSearch() {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const q = query.trim()
      const digits = normalizeCnpj(q)

      const [{ data: tickets }, { data: companies }, { data: conveniadas }] = await Promise.all([
        // Atendimentos
        supabase.from('tickets_with_details')
          .select('id, protocol, status, company_legal_name, company_name_free, employee_name, type_name, type, description')
          .or(`protocol.ilike.%${q}%,company_legal_name.ilike.%${q}%,company_name_free.ilike.%${q}%,requester_name.ilike.%${q}%,employee_name.ilike.%${q}%,type_name.ilike.%${q}%`)
          .limit(5),
        // Empresas (companies)
        supabase.from('companies')
          .select('id, legal_name, trade_name, cnpj, city')
          .or(`legal_name.ilike.%${q}%,trade_name.ilike.%${q}%,cnpj.ilike.%${digits.length>=3?digits:q}%`)
          .limit(3),
        // Empresas conveniadas
        supabase.from('empresas_conveniadas')
          .select('id, nome_fantasia, razao_social, cnpj, municipio, uf')
          .or(`nome_fantasia.ilike.%${q}%,razao_social.ilike.%${q}%,cnpj.ilike.%${digits.length>=3?digits:q}%`)
          .limit(3),
      ])

      const ticketResults: Result[] = (tickets ?? []).map((t: any) => ({
        id: t.id, type: 'ticket',
        title: t.protocol + ' — ' + (t.company_name_free ?? t.company_legal_name ?? 'Sem empresa'),
        subtitle: t.type_name ?? t.type ?? '',
        href: '/atendimentos/' + t.id,
        status: t.status,
      }))

      const companyResults: Result[] = [
        ...(companies ?? []).map((c: any) => ({
          id: c.id, type: 'company' as const,
          title: c.trade_name || c.legal_name,
          subtitle: (c.cnpj ? c.cnpj + ' · ' : '') + (c.city ?? ''),
          href: '/empresas/' + c.id,
        })),
        ...(conveniadas ?? []).map((c: any) => ({
          id: c.id, type: 'company' as const,
          title: c.nome_fantasia,
          subtitle: (c.razao_social ? c.razao_social + ' · ' : '') + (c.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') ?? '') + (c.municipio ? ' · ' + c.municipio + '/' + c.uf : ''),
          href: '/empresas/' + c.id,
        })),
      ].slice(0, 5)

      setResults([...ticketResults, ...companyResults])
      setSelected(0)
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  function navigate(href: string) {
    setOpen(false); setQuery(''); setResults([])
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected].href)
  }

  if (!open) return (
    <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400 hover:border-gray-300 transition-colors w-48">
      <Search size={13} />
      <span>Buscar...</span>
      <span className="ml-auto font-mono text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Ctrl+K</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => { setOpen(false); setQuery('') }} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
            placeholder="Protocolo, empresa, CNPJ, razão social, fantasia..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          <kbd className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Buscando...</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Nenhum resultado para "{query}"</div>
          )}
          {!loading && query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Digite pelo menos 2 caracteres — busca por protocolo, empresa, CNPJ ou razão social
            </div>
          )}
          {results.map((r, i) => (
            <button key={r.id + i} onClick={() => navigate(r.href)}
              className={cn('w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-0',
                i === selected ? 'bg-blue-50' : 'hover:bg-gray-50')}>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                r.type === 'ticket' ? 'bg-blue-50' : 'bg-green-50')}>
                {r.type === 'ticket'
                  ? <Ticket size={14} className="text-blue-600" />
                  : <Building2 size={14} className="text-green-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{r.subtitle}</div>
              </div>
              {r.status && (
                <span className={cn('badge flex-shrink-0 text-xs mt-0.5', STATUS_COLORS[r.status])}>
                  {STATUS_LABELS[r.status]}
                </span>
              )}
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
            <span>↑↓ navegar</span>
            <span>Enter selecionar</span>
            <span>Esc fechar</span>
          </div>
        )}
      </div>
    </div>
  )
}
