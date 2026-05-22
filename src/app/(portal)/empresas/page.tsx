import { createClient } from '@/lib/supabase/server'
import { COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Plus, Building2 } from 'lucide-react'
import Link from 'next/link'
import type { Company } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function EmpresasPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('*, partner:partner_id(name)')
    .order('legal_name')

  const list = (companies ?? []) as (Company & { partner: { name: string } | null })[]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Empresas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{list.length} empresas cadastradas</p>
        </div>
        <button className="btn-primary">
          <Plus size={15} />
          Nova empresa
        </button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <input className="input pl-9" placeholder="Buscar por nome, CNPJ ou cidade…" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
        <select className="select w-40">
          <option value="">Todos status</option>
          <option value="ativa">Ativa</option>
          <option value="inativa">Inativa</option>
          <option value="bloqueada">Bloqueada</option>
        </select>
      </div>

      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns: '1fr 140px 160px 60px 90px' }}>
          <span>Empresa</span>
          <span>Cidade / UF</span>
          <span>Parceiro</span>
          <span>Atend.</span>
          <span>Status</span>
        </div>

        {list.map(company => (
          <Link
            key={company.id}
            href={`/empresas/${company.id}`}
            className="table-row grid hover:bg-blue-50/30"
            style={{ gridTemplateColumns: '1fr 140px 160px 60px 90px' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-semibold flex-shrink-0">
                {company.legal_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {company.trade_name || company.legal_name}
                </div>
                <div className="text-xs text-gray-400 font-mono">{company.cnpj}</div>
              </div>
            </div>
            <span className="text-sm text-gray-600">{company.city}, {company.state}</span>
            <span className="text-sm text-gray-600 truncate">{company.partner?.name ?? '—'}</span>
            <span className="text-sm text-gray-400">—</span>
            <span className={cn('badge', COMPANY_STATUS_COLORS[company.status])}>
              {COMPANY_STATUS_LABELS[company.status]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

