import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Company } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function EmpresaDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('*, partner:partner_id(name)')
    .eq('id', params.id)
    .single()

  if (!company) notFound()

  const c = company as Company & { partner: { name: string } | null }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/empresas" className="btn btn-sm">
          <ArrowLeft size={14} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {c.trade_name || c.legal_name}
          </h1>
          <span className={cn('badge mt-1', COMPANY_STATUS_COLORS[c.status])}>
            {COMPANY_STATUS_LABELS[c.status]}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Dados cadastrais</span></div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              ['Razão social', c.legal_name],
              ['Nome fantasia', c.trade_name ?? '—'],
              ['CNPJ', c.cnpj],
              ['Cidade / UF', `${c.city} / ${c.state}`],
              ['Contato RH', c.contact_name],
              ['Telefone', c.contact_phone ?? '—'],
              ['E-mail', c.contact_email ?? '—'],
              ['Parceiro', c.partner?.name ?? '—'],
              ['Cadastro', formatDate(c.created_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs text-gray-400 mb-0.5">{k}</div>
                <div className="text-sm font-medium text-gray-900">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

