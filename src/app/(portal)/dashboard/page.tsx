'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge, PriorityBadge } from '@/components/tickets/StatusBadge'
import { TYPE_LABELS } from '@/lib/constants'
import { useDepartments } from '@/hooks/useDepartments'
import { useEquipes } from '@/hooks/useEquipes'
import SlaAlertPanel from '@/components/dashboard/SlaAlert'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardSummary, TicketWithDetails } from '@/lib/types'

// Sentinela para atendimentos sem equipe atribuída
const SEM_EQUIPE = '__none__'

export default function DashboardPage() {
  const supabase = createClient()
  const { deptLabels: DEPARTMENT_LABELS } = useDepartments()
  const { equipes } = useEquipes()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  // Conjunto completo de atendimentos em aberto (para a leitura por equipe)
  const [openTickets, setOpenTickets] = useState<any[]>([])
  // Equipe por ticket (tickets.equipe_id) — a view pode não expor a coluna.
  const [equipeByTicket, setEquipeByTicket] = useState<Record<string, string | null>>({})

  useEffect(() => {
    supabase.from('dashboard_summary').select('*').then(({ data }) => {
      setSummary(data?.[0] as DashboardSummary ?? null)
    })
    supabase.from('tickets_with_details').select('*')
      .not('status', 'in', '("finalizado","cancelado","rascunho")')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setTickets((data as TicketWithDetails[]) ?? []))
    supabase.from('tickets_with_details').select('id, status, sla_breached, equipe_id')
      .not('status', 'in', '("finalizado","cancelado","rascunho")')
      .limit(5000)
      .then(({ data }) => setOpenTickets((data as any[]) ?? []))
    supabase.from('tickets').select('id, equipe_id').limit(5000)
      .then(({ data }) => {
        const map: Record<string, string | null> = {}
        for (const r of (data as any[]) ?? []) map[r.id] = r.equipe_id ?? null
        setEquipeByTicket(map)
      })
  }, [])

  const resolveEquipe = (t: any): string => (t.equipe_id ?? equipeByTicket[t.id] ?? '') || ''

  // Em aberto por equipe (somente leitura) — vencidos destacados
  const equipeStats = useMemo(() => {
    const open: Record<string, number> = {}
    const vencidos: Record<string, number> = {}
    for (const t of openTickets) {
      const key = resolveEquipe(t) || SEM_EQUIPE
      open[key] = (open[key] ?? 0) + 1
      if (t.sla_breached) vencidos[key] = (vencidos[key] ?? 0) + 1
    }
    return { open, vencidos }
  }, [openTickets, equipeByTicket])

  const equipeChips = useMemo(() => {
    const list = equipes.map(eq => ({ key: eq.id, label: eq.label }))
    if ((equipeStats.open[SEM_EQUIPE] ?? 0) > 0) list.push({ key: SEM_EQUIPE, label: 'Sem equipe' })
    return list
  }, [equipes, equipeStats])

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

      {/* Em aberto por equipe (somente leitura) */}
      {equipeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Em aberto por equipe:</span>
          {equipeChips.map(chip => {
            const count = equipeStats.open[chip.key] ?? 0
            const venc  = equipeStats.vencidos[chip.key] ?? 0
            return (
              <span
                key={chip.key}
                title={`${chip.label}: ${count} em aberto${venc ? ` · ${venc} com SLA vencido` : ''}`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-vg-surface border-vg-border-field/40 text-vg-ink-secondary',
                  count === 0 && 'opacity-40',
                )}
              >
                <span>{chip.label}</span>
                <span className="font-semibold text-vg-ink">{count}</span>
                {venc > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1 rounded bg-vg-danger-bg text-vg-danger-fg font-semibold">
                    <AlertTriangle size={10} />{venc}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}

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
