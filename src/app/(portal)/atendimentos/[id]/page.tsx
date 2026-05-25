import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StatusBadge, PriorityBadge } from '@/components/tickets/StatusBadge'
import TicketActions from '@/components/tickets/TicketActions'
import TicketHistoryPanel from '@/components/tickets/TicketHistoryPanel'
import { formatDate, formatDuration, slaPercent, initials } from '@/lib/utils'
import { DEPARTMENT_LABELS, TYPE_LABELS, COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS } from '@/lib/constants'
import { ArrowLeft, Building2, User, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { TicketWithDetails, TicketHistory } from '@/lib/types'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [{ data: ticket }, { data: history }] = await Promise.all([
    supabase
      .from('tickets_with_details')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('ticket_history')
      .select('*, user:user_id(full_name, role)')
      .eq('ticket_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  if (!ticket) notFound()

  const t = ticket as TicketWithDetails
  const hist = (history ?? []) as TicketHistory[]

  const sla = slaPercent(t.created_at, t.sla_deadline)
  const slaColor = sla >= 90 ? 'bg-red-500' : sla >= 70 ? 'bg-amber-400' : 'bg-[#185FA5]'

  return (
    <div className="p-6">
      {/* Topbar */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/atendimentos" className="btn btn-sm">
          <ArrowLeft size={14} />
        </Link>
        <span className="font-mono text-sm text-gray-400">{t.protocol}</span>
        <StatusBadge status={t.status} />
        <PriorityBadge priority={t.priority} />
        {t.sla_breached && (
          <span className="badge bg-red-50 text-red-600 border border-red-200">
            <AlertTriangle size={11} />
            SLA vencido
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* Coluna principal */}
        <div className="space-y-5">

          {/* Info card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Informações</span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                {[
                  ['Empresa',           t.company_legal_name],
                  ['Solicitante (RH)',  t.requester_name],
                  ['Colaborador',       t.employee_name ?? '—'],
                  ['Tipo',             TYPE_LABELS[t.type]],
                  ['Departamento',     DEPARTMENT_LABELS[t.department]],
                  ['Parceiro',         t.partner_name ?? '—'],
                  ['Responsável',      t.assigned_to_name ?? '—'],
                  ['Aberto por',       t.created_by_name],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-gray-900">{value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-2">Descrição</div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed">
                  {t.description}
                </div>
              </div>
            </div>
          </div>

          {/* Histórico */}
          <TicketHistoryPanel ticketId={t.id} history={hist} />
        </div>

        {/* Sidebar direita */}
        <div className="space-y-4">

          {/* Ações */}
          <TicketActions ticket={t} />

          {/* SLA */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Clock size={14} /> SLA</span>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Prazo</span>
                <span className="font-medium text-gray-700">{formatDate(t.sla_deadline)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', slaColor)}
                  style={{ width: `${sla}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 text-right">{sla}% do tempo</div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                {[
                  ['Abertura',     formatDate(t.created_at)],
                  ['1ª resposta',  t.first_response_at ? formatDate(t.first_response_at) : 'Pendente'],
                  ['Tempo aberto', formatDuration(t.open_seconds)],
                  ['Fechamento',   t.closed_at ? formatDate(t.closed_at) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-400">{k}</span>
                    <span className="font-medium text-gray-700 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Empresa */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Building2 size={14} /> Empresa</span>
              <Link href={`/empresas/${t.company_id}`} className="btn btn-sm text-xs">
                Ver
              </Link>
            </div>
            <div className="card-body space-y-2">
              {[
                ['Razão social', t.company_legal_name],
                ['Cidade',       `${t.company_city}/${t.company_state}`],
                ['Parceiro',     t.partner_name ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-400">{k}</span>
                  <span className="font-medium text-gray-700 text-right max-w-[140px] truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

