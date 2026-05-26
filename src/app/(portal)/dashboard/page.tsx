'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge, PriorityBadge } from '@/components/tickets/StatusBadge'
import { TYPE_LABELS, DEPARTMENT_LABELS } from '@/lib/constants'
import SlaAlertPanel from '@/components/dashboard/SlaAlert'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { DashboardSummary, TicketWithDetails } from '@/lib/types'

export default function DashboardPage() {
  const supabase = createClient()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])

  useEffect(() => {
    supabase.from('dashboard_summary').select('*').then(({ data }) => {
      setSummary(data?.[0] as DashboardSummary ?? null)
    })
    supabase.from('tickets_with_details').select('*')
      .not('status', 'in', '("finalizado","cancelado","rascunho")')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setTickets((data as TicketWithDetails[]) ?? []))
  }, [])

  const metrics = [
    { label: 'Abertos hoje',      value: summary?.opened_today ?? 0,  suffix: '' },
    { label: 'Em aberto',         value: summary?.open_total ?? 0,    suffix: '' },
    { label: 'Finalizados (mes)', value: summary?.closed_month ?? 0,  suffix: '' },
    { label: 'Tempo medio',       value: summary?.avg_resolution_hours_week?.toFixed(1) ?? '—', suffix: 'h' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Visao geral dos atendimentos</p>
        </div>
        <Link href="/atendimentos/novo" className="btn-primary">
          <Plus size={15} /> Novo atendimento
        </Link>
      </div>

      {/* Alerta SLA — aparece automaticamente quando ha tickets criticos */}
      <SlaAlertPanel />

      <div className="grid grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}{m.suffix}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Atendimentos em aberto</span>
          <Link href="/atendimentos" className="btn btn-sm text-xs">Ver todos</Link>
        </div>
        <div className="table-header grid" style={{ gridTemplateColumns: '130px 1fr 120px 90px 130px' }}>
          <span>Protocolo</span><span>Empresa / Tipo</span><span>Departamento</span><span>Prioridade</span><span>Status</span>
        </div>
        {tickets.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum atendimento em aberto</div>
        ) : tickets.map(ticket => (
          <Link key={ticket.id} href={'/atendimentos/' + ticket.id}
            className="table-row grid hover:bg-blue-50/30"
            style={{ gridTemplateColumns: '130px 1fr 120px 90px 130px' }}>
            <span className="font-mono text-xs text-gray-400">{ticket.protocol}</span>
            <div>
              <div className="text-sm font-medium text-gray-900 truncate">{ticket.company_legal_name}</div>
              <div className="text-xs text-gray-400 truncate">
                {TYPE_LABELS[ticket.type] ?? ticket.type}
                {ticket.employee_name && ' — ' + ticket.employee_name}
              </div>
            </div>
            <span className="text-xs text-gray-500">{DEPARTMENT_LABELS[ticket.department] ?? ticket.department}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </Link>
        ))}
      </div>
    </div>
  )
}
