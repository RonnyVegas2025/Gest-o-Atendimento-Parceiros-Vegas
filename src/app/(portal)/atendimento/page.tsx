import { createClient } from '@/lib/supabase/server'
import { StatusBadge, PriorityBadge } from '@/components/tickets/StatusBadge'
import { formatDateShort } from '@/lib/utils'
import { DEPARTMENT_LABELS, TYPE_LABELS } from '@/lib/constants'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { TicketWithDetails } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: { status?: string; department?: string }
}) {
  const supabase = await createClient()

  let query = supabase
    .from('tickets_with_details')
    .select('*')
    .order('created_at', { ascending: false })

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.department) query = query.eq('department', searchParams.department)

  const { data: tickets } = await query.limit(50)
  const list = (tickets ?? []) as TicketWithDetails[]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Atendimentos</h1>
          <p className="text-xs text-gray-400 mt-0.5">{list.length} registros</p>
        </div>
        <Link href="/atendimentos/novo" className="btn-primary">
          <Plus size={15} />
          Novo atendimento
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <input
            className="input pl-9"
            placeholder="Buscar por empresa ou protocolo…"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>

        <form className="flex gap-2">
          <select name="status" defaultValue={searchParams.status ?? ''} className="select w-44">
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="em_analise">Em análise</option>
            <option value="em_andamento">Em andamento</option>
            <option value="aguardando_retorno">Aguardando retorno</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select name="department" defaultValue={searchParams.department ?? ''} className="select w-44">
            <option value="">Todos os depto.</option>
            <option value="operacional">Operacional</option>
            <option value="cadastro">Cadastro</option>
            <option value="financeiro">Financeiro</option>
            <option value="comercial">Comercial</option>
            <option value="rede">Rede</option>
          </select>
          <button type="submit" className="btn">Filtrar</button>
        </form>
      </div>

      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns: '140px 1fr 120px 90px 155px 100px' }}>
          <span>Protocolo</span>
          <span>Empresa / Tipo</span>
          <span>Departamento</span>
          <span>Prioridade</span>
          <span>Status</span>
          <span>Abertura</span>
        </div>

        {list.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhum atendimento encontrado
          </div>
        ) : (
          list.map(ticket => (
            <Link
              key={ticket.id}
              href={`/atendimentos/${ticket.id}`}
              className="table-row grid hover:bg-blue-50/30"
              style={{ gridTemplateColumns: '140px 1fr 120px 90px 155px 100px' }}
            >
              <span className="font-mono text-xs text-gray-400">{ticket.protocol}</span>
              <div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {ticket.company_legal_name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {TYPE_LABELS[ticket.type]}
                  {ticket.employee_name && ` — ${ticket.employee_name}`}
                </div>
              </div>
              <span className="text-xs text-gray-500">{DEPARTMENT_LABELS[ticket.department]}</span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
              <span className="text-xs text-gray-400">{formatDateShort(ticket.created_at)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

