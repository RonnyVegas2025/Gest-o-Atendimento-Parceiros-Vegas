'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PriorityBadge } from '@/components/tickets/StatusBadge'
import { formatDateShort } from '@/lib/utils'
import { DEPARTMENT_LABELS, TYPE_LABELS } from '@/lib/constants'
import Link from 'next/link'
import { Plus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TicketWithDetails } from '@/lib/types'

const STATUS_BADGE: Record<string, string> = {
  rascunho:           'bg-amber-50 text-amber-600 border border-amber-200',
  aberto:             'bg-blue-50 text-blue-700 border border-blue-200',
  em_analise:         'bg-amber-50 text-amber-700 border border-amber-200',
  encaminhado:        'bg-purple-50 text-purple-700 border border-purple-200',
  em_andamento:       'bg-green-50 text-green-700 border border-green-200',
  aguardando_retorno: 'bg-gray-100 text-gray-600 border border-gray-200',
  finalizado:         'bg-green-100 text-green-800 border border-green-300',
  cancelado:          'bg-red-50 text-red-700 border border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  rascunho:           'Rascunho',
  aberto:             'Aberto',
  em_analise:         'Em analise',
  encaminhado:        'Encaminhado',
  em_andamento:       'Em andamento',
  aguardando_retorno: 'Aguardando',
  finalizado:         'Finalizado',
  cancelado:          'Cancelado',
}

export default function AtendimentosPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [department, setDepartment] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('tickets_with_details')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (status) query = query.eq('status', status)
      if (department) query = query.eq('department', department)
      if (search) query = query.or(
        `protocol.ilike.%${search}%,company_legal_name.ilike.%${search}%,employee_name.ilike.%${search}%`
      )

      const { data } = await query
      setTickets((data as TicketWithDetails[]) ?? [])
      setLoading(false)
    }
    load()
  }, [status, department, search])

  const drafts = tickets.filter(t => t.status === 'rascunho')
  const others = tickets.filter(t => t.status !== 'rascunho')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Atendimentos</h1>
          <p className="text-xs text-gray-400 mt-0.5">{tickets.length} registros</p>
        </div>
        <Link href="/atendimentos/novo" className="btn-primary">
          <Plus size={15} /> Novo atendimento
        </Link>
      </div>

      {/* Rascunhos em destaque */}
      {drafts.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <div className="card-header border-amber-100">
            <span className="card-title text-amber-700">
              <Zap size={14} className="text-amber-500" />
              Pre-atendimentos ({drafts.length})
            </span>
            <span className="text-xs text-amber-600">Clique para completar os dados</span>
          </div>
          {drafts.map(ticket => (
            <Link key={ticket.id} href={`/atendimentos/${ticket.id}`}
              className="table-row grid hover:bg-amber-50"
              style={{ gridTemplateColumns: '140px 1fr 120px 90px 100px 100px' }}>
              <span className="font-mono text-xs text-gray-400">{ticket.protocol}</span>
              <div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {ticket.company_legal_name ?? 'Empresa nao informada'}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {ticket.employee_name ?? 'Colaborador nao informado'}
                </div>
              </div>
              <span className="text-xs text-gray-500">{DEPARTMENT_LABELS[ticket.department] ?? ticket.department}</span>
              <PriorityBadge priority={ticket.priority} />
              <span className={cn('badge', STATUS_BADGE['rascunho'])}>Rascunho</span>
              <span className="text-xs text-gray-400">{formatDateShort(ticket.created_at)}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <input className="input max-w-xs" placeholder="Buscar por empresa ou protocolo..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select w-44" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="aberto">Aberto</option>
          <option value="em_analise">Em analise</option>
          <option value="em_andamento">Em andamento</option>
          <option value="aguardando_retorno">Aguardando retorno</option>
          <option value="finalizado">Finalizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select className="select w-44" value={department} onChange={e => setDepartment(e.target.value)}>
          <option value="">Todos os depto.</option>
          <option value="comercial">ADM Comercial</option>
          <option value="operacional">Operacional</option>
          <option value="cadastro">Cadastro</option>
          <option value="financeiro">Financeiro</option>
          <option value="comercial">Comercial</option>
          <option value="rede">Rede</option>
          <option value="marketing">Marketing</option>
          <option value="juridico">Juridico</option>
          <option value="logistica">Logistica</option>
        </select>
      </div>

      {/* Lista principal */}
      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns: '140px 1fr 120px 90px 155px 100px' }}>
          <span>Protocolo</span><span>Empresa / Tipo</span><span>Departamento</span>
          <span>Prioridade</span><span>Status</span><span>Abertura</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : others.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum atendimento encontrado</div>
        ) : others.map(ticket => (
          <Link key={ticket.id} href={`/atendimentos/${ticket.id}`}
            className="table-row grid hover:bg-blue-50/30"
            style={{ gridTemplateColumns: '140px 1fr 120px 90px 155px 100px' }}>
            <span className="font-mono text-xs text-gray-400">{ticket.protocol}</span>
            <div>
              <div className="text-sm font-medium text-gray-900 truncate">
                {ticket.company_legal_name ?? 'Empresa nao informada'}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {TYPE_LABELS[ticket.type] ?? ticket.type}
                {ticket.employee_name && ` - ${ticket.employee_name}`}
              </div>
            </div>
            <span className="text-xs text-gray-500">{DEPARTMENT_LABELS[ticket.department] ?? ticket.department}</span>
            <PriorityBadge priority={ticket.priority} />
            <span className={cn('badge', STATUS_BADGE[ticket.status] ?? 'bg-gray-100 text-gray-600')}>
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </span>
            <span className="text-xs text-gray-400">{formatDateShort(ticket.created_at)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
