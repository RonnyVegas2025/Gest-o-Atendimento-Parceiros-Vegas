import { createClient } from '@/lib/supabase/server'
import { StatusBadge, PriorityBadge } from '@/components/tickets/StatusBadge'
import { formatDateShort, formatDuration } from '@/lib/utils'
import { DEPARTMENT_LABELS, TYPE_LABELS } from '@/lib/constants'
import Link from 'next/link'
import { AlertTriangle, Plus } from 'lucide-react'
import type { DashboardSummary, TicketWithDetails } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: summaryArr }, { data: tickets }] = await Promise.all([
    supabase.from('dashboard_summary').select('*'),
    supabase
      .from('tickets_with_details')
      .select('*')
      .not('status', 'in', '("finalizado","cancelado")')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const s = (summaryArr?.[0] ?? {}) as DashboardSummary
  const list = (tickets ?? []) as TicketWithDetails[]

  const metrics = [
    { label: 'Abertos hoje',       value: s.opened_today ?? 0,                      suffix: '' },
    { label: 'Em aberto',          value: s.open_total ?? 0,                         suffix: '' },
    { label: 'Finalizados (mês)',  value: s.closed_month ?? 0,                       suffix: '' },
    { label: 'Tempo médio',        value: s.avg_resolution_hours_week?.toFixed(1) ?? '—', suffix: 'h' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Visão geral dos atendimentos</p>
        </div>
        <Link href="/atendimentos/novo" className="btn-primary">
          <Plus size={15} />
          Novo atendimento
        </Link>
      </div>

      {/* SLA Alert */}
      {(s.sla_breached ?? 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>
            <strong>{s.sla_breached}</strong> atendimento{s.sla_breached > 1 ? 's' : ''} com SLA vencido.{' '}
            <Link href="/atendimentos?sla=vencido" className="underline underline-offset-2">
              Ver agora
            </Link>
          </span>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">
              {m.value}{m.suffix}
            </div>
          </div>
        ))}
      </div>

      {/* Tickets abertos */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Atendimentos em aberto</span>
          <Link href="/atendimentos" className="btn btn-sm text-xs">
            Ver todos
          </Link>
        </div>

        {/* Header da tabela */}
        <div className="table-header" style={{ gridTemplateColumns: '130px 1fr 120px 90px 130px' }}>
          <span>Protocolo</span>
          <span>Empresa / Tipo</span>
          <span>Departamento</span>
          <span>Prioridade</span>
          <span>Status</span>
        </div>

        {list.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhum atendimento em aberto
          </div>
        ) : (
          list.map(ticket => (
            <Link
              key={ticket.id}
              href={`/atendimentos/${ticket.id}`}
              className="table-row grid hover:bg-blue-50/30"
              style={{ gridTemplateColumns: '130px 1fr 120px 90px 130px' }}
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
              <span className="text-xs text-gray-500">
                {DEPARTMENT_LABELS[ticket.department]}
              </span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

