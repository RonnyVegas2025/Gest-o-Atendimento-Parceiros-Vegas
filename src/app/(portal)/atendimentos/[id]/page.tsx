'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, timeAgo, formatDuration } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_DOT } from '@/lib/constants'
import type { TicketWithDetails, TicketHistory } from '@/lib/types'
import { ArrowLeft, Clock, Building2, Send, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Paperclip } from 'lucide-react'
import FileUpload from '@/components/tickets/FileUpload'
import PasteTextarea from '@/components/ui/PasteTextarea'
import Link from 'next/link'

const DEPARTMENTS = [
  { value: 'comercial',   label: 'ADM Comercial' },
  { value: 'cadastro',    label: 'Cadastro' },
  { value: 'financeiro',  label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'rede',        label: 'Rede' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'juridico',    label: 'Jurídico' },
  { value: 'logistica',   label: 'Logística' },
]

const DEPT_COLORS: Record<string, string> = {
  comercial:   'bg-blue-100 text-blue-700',
  cadastro:    'bg-purple-100 text-purple-700',
  financeiro:  'bg-amber-100 text-amber-700',
  operacional: 'bg-green-100 text-green-700',
  rede:        'bg-cyan-100 text-cyan-700',
  marketing:   'bg-pink-100 text-pink-700',
  juridico:    'bg-red-100 text-red-700',
  logistica:   'bg-orange-100 text-orange-700',
}

const NEXT_STATUSES: Record<string, { value: string; label: string; color: string; icon?: string }[]> = {
  aberto: [
    { value: 'em_analise', label: 'Iniciar análise', color: 'btn-primary', icon: 'play' },
  ],
  em_analise: [
    { value: 'em_andamento',       label: '▶ Colocar em andamento',     color: 'btn-primary' },
    { value: 'encaminhado',        label: '→ Encaminhar para depto',    color: 'btn' },
    { value: 'aguardando_retorno', label: '⏸ Aguardar retorno',         color: 'btn' },
    { value: 'finalizado',         label: '✓ Finalizar atendimento',    color: 'btn' },
  ],
  encaminhado: [
    { value: 'em_andamento',       label: '✅ Depto concluiu — retomar para ADM Comercial', color: 'btn-primary' },
    { value: 'encaminhado',        label: '→ Reencaminhar para outro depto',                color: 'btn' },
    { value: 'aguardando_retorno', label: '⏸ Aguardar retorno',                             color: 'btn' },
    { value: 'finalizado',         label: '✓ Finalizar diretamente',                        color: 'btn' },
  ],
  em_andamento: [
    { value: 'finalizado',         label: '✓ Finalizar atendimento',    color: 'btn-primary' },
    { value: 'encaminhado',        label: '→ Encaminhar para depto',    color: 'btn' },
    { value: 'aguardando_retorno', label: '⏸ Aguardar retorno cliente', color: 'btn' },
  ],
  aguardando_retorno: [
    { value: 'em_andamento',       label: '▶ Cliente retornou — retomar', color: 'btn-primary' },
    { value: 'encaminhado',        label: '→ Encaminhar para depto',      color: 'btn' },
    { value: 'finalizado',         label: '✓ Finalizar atendimento',      color: 'btn' },
  ],
  finalizado: [],
  cancelado:  [],
}

const TL_COLORS: Record<string, string> = {
  aberto:             'bg-blue-500',
  em_analise:         'bg-amber-400',
  encaminhado:        'bg-purple-500',
  em_andamento:       'bg-green-500',
  aguardando_retorno: 'bg-gray-400',
  finalizado:         'bg-green-600',
  cancelado:          'bg-red-500',
  obs:                'bg-gray-300',
}

export default function TicketDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [history, setHistory] = useState<TicketHistory[]>([])
  const [loading, setLoading] = useState(true)

  // Ação
  const [actionStatus, setActionStatus] = useState('')
  const [actionDept, setActionDept] = useState('')
  const [actionObs, setActionObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [obsText, setObsText] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from('tickets_with_details').select('*').eq('id', id).single(),
      supabase.from('ticket_history').select('*, user:user_id(full_name)').eq('ticket_id', id).order('created_at', { ascending: true }),
    ])
    setTicket(t as TicketWithDetails)
    setHistory((h as TicketHistory[]) ?? [])
    setLoading(false)
    if (t) setActionDept(t.department)
    // Load attachments
    const { data: atts } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    setAttachments(atts ?? [])
  }

  async function handleAction() {
    if (!actionStatus) return
    setSaving(true)

    const isForwarding = actionStatus === 'encaminhado'
    const isReturning = actionStatus === 'em_andamento' && ticket?.status === 'encaminhado'
    const deptLabel = DEPARTMENTS.find(d => d.value === actionDept)?.label ?? actionDept
    const statusLabel = ALLOWED_TRANSITIONS_LABELS[actionStatus] ?? actionStatus

    let actionText = `Status alterado para "${statusLabel}"`
    if (isForwarding) actionText = `📤 Encaminhado para: ${deptLabel}`
    if (isReturning)  actionText = `📥 ${deptLabel} concluiu — retomado pelo ADM Comercial`
    if (actionObs) actionText += ` · ${actionObs}`

    // Update ticket
    const updatePayload: Record<string, string> = { status: actionStatus }
    if (isForwarding) updatePayload.department = actionDept
    if (isReturning)  updatePayload.department = 'comercial'

    await supabase.from('tickets').update(updatePayload).eq('id', id)

    // Insert history
    await supabase.from('ticket_history').insert({
      ticket_id:   id,
      action:      actionText,
      observation: actionObs || null,
      from_status: ticket?.status,
      to_status:   actionStatus,
      user_id:     '00000000-0000-0000-0000-000000000001',
    })

    setActionStatus('')
    setActionObs('')
    setSaving(false)
    fetchData()
  }

  async function handleObs() {
    if (!obsText.trim()) return
    setSavingObs(true)
    await supabase.from('ticket_history').insert({
      ticket_id:   id,
      action:      obsText.trim(),
      observation: obsText.trim(),
      user_id:     '00000000-0000-0000-0000-000000000001',
    })
    setObsText('')
    setSavingObs(false)
    fetchData()
  }

  async function cancelTicket() {
    if (!confirm('Cancelar este atendimento?')) return
    await supabase.from('tickets').update({ status: 'cancelado' }).eq('id', id)
    await supabase.from('ticket_history').insert({
      ticket_id: id, action: 'Atendimento cancelado',
      from_status: ticket?.status, to_status: 'cancelado',
      user_id: '00000000-0000-0000-0000-000000000001',
    })
    fetchData()
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando…</div>
  if (!ticket) return <div className="p-6 text-sm text-red-500">Atendimento não encontrado.</div>

  const isClosed = ['finalizado', 'cancelado'].includes(ticket.status)
  const nextActions = NEXT_STATUSES[ticket.status] ?? []
  const currentDeptLabel = DEPARTMENTS.find(d => d.value === ticket.department)?.label ?? ticket.department
  const sla = ticket.sla_deadline ? Math.min(100, Math.round(
    (ticket.open_seconds / ((new Date(ticket.sla_deadline).getTime() - new Date(ticket.created_at).getTime()) / 1000)) * 100
  )) : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/atendimentos" className="btn btn-sm"><ArrowLeft size={14} /></Link>
        <span className="font-mono text-sm text-gray-400">{ticket.protocol}</span>
        <span className={cn('badge', STATUS_COLORS[ticket.status])}>{STATUS_LABELS[ticket.status]}</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[ticket.priority])} />
          {ticket.priority === 'alta' ? 'Alta' : ticket.priority === 'media' ? 'Média' : 'Baixa'}
        </span>
        <span className={cn('badge', DEPT_COLORS[ticket.department] ?? 'bg-gray-100 text-gray-600')}>
          📍 {currentDeptLabel}
        </span>
        {ticket.sla_breached && (
          <span className="badge bg-red-50 text-red-600 border border-red-200">
            <AlertTriangle size={11} /> SLA vencido
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* Coluna principal */}
        <div className="space-y-5">

          {/* Informações */}
          <div className="card">
            <div className="card-header"><span className="card-title">Informações</span></div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                {[
                  ['Empresa',          ticket.company_legal_name],
                  ['Solicitante (RH)', ticket.requester_name],
                  ['Colaborador',      ticket.employee_name ?? '—'],
                  ['Tipo',             ticket.type],
                  ['Departamento atual', currentDeptLabel],
                  ['Parceiro',         ticket.partner_name ?? '—'],
                  ['Responsável',      ticket.assigned_to_name ?? '—'],
                  ['Aberto por',       ticket.created_by_name],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-gray-900">{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-2">Descrição</div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed">{ticket.description}</div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Timeline</span>
              <span className="text-xs text-gray-400">{history.length} eventos</span>
            </div>
            <div className="card-body">
              {history.length > 0 ? (
                <ol className="relative pl-6 border-l border-gray-100 space-y-5 mb-6">
                  {history.map((item, idx) => {
                    const dot = item.to_status ? TL_COLORS[item.to_status] : (idx === 0 ? TL_COLORS.aberto : TL_COLORS.obs)
                    const userName = (item.user as any)?.full_name ?? 'Sistema'
                    return (
                      <li key={item.id} className="relative">
                        <span className={cn('absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white', dot)} />
                        <div className="text-sm font-medium text-gray-900">{item.action}</div>
                        {item.observation && item.observation !== item.action && (
                          <div className="text-xs text-gray-500 mt-0.5 bg-gray-50 px-3 py-1.5 rounded-lg mt-1">{item.observation}</div>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          <span className="font-medium">{userName}</span>
                          <span title={formatDate(item.created_at)}>{timeAgo(item.created_at)}</span>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <div className="text-xs text-gray-400 text-center py-6 mb-4">Nenhum evento registrado ainda</div>
              )}

              {/* Adicionar observação */}
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-medium text-gray-600 mb-2">Adicionar observação</div>
                <PasteTextarea
                  value={obsText}
                  onChange={setObsText}
                  ticketId={id}
                  placeholder="Descreva uma atualização — use Ctrl+V para colar prints do WhatsApp…"
                  rows={2}
                />
                <div className="flex justify-end mt-2">
                  <button onClick={handleObs} disabled={!obsText.trim() || savingObs} className="btn-primary btn-sm">
                    <Send size={13} /> {savingObs ? 'Registrando…' : 'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar direita */}
        <div className="space-y-4">

          {/* Ações */}
          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Ações</span></div>
            <div className="card-body space-y-3">
              {isClosed ? (
                <p className="text-xs text-gray-400 text-center py-2">Atendimento encerrado</p>
              ) : (
                <>
                  {nextActions.map(action => (
                    <button
                      key={action.value}
                      onClick={() => setActionStatus(prev => prev === action.value ? '' : action.value)}
                      className={cn(
                        'w-full justify-center text-sm',
                        actionStatus === action.value ? 'btn-primary' : 'btn'
                      )}
                    >
                      {action.value === 'finalizado' && <CheckCircle2 size={14} />}
                      {action.value === 'encaminhado' && <ArrowRight size={14} />}
                      {action.label}
                    </button>
                  ))}

                  {/* Encaminhar para depto */}
                  {actionStatus === 'encaminhado' && (
                    <div className="space-y-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <div className="text-xs font-medium text-purple-700">Encaminhar para qual departamento?</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DEPARTMENTS.map(d => (
                          <button key={d.value} type="button"
                            onClick={() => setActionDept(d.value)}
                            className={cn(
                              'text-xs px-2 py-1.5 rounded-lg border transition-colors text-left',
                              actionDept === d.value
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                            )}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observação da ação */}
                  {actionStatus && (
                    <PasteTextarea
                      value={actionObs}
                      onChange={setActionObs}
                      ticketId={id}
                      placeholder="Observação sobre esta ação — Ctrl+V para colar imagens…"
                      rows={2}
                    />
                  )}

                  {actionStatus && (
                    <button onClick={handleAction} disabled={saving} className="btn-primary w-full justify-center">
                      <CheckCircle2 size={14} />
                      {saving ? 'Salvando…' : 'Confirmar ação'}
                    </button>
                  )}

                  <div className="border-t border-gray-100 pt-2">
                    <button onClick={cancelTicket} className="btn-danger w-full justify-center">
                      <XCircle size={14} /> Cancelar atendimento
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* SLA */}
          <div className="card">
            <div className="card-header"><span className="card-title"><Clock size={14} /> SLA</span></div>
            <div className="card-body space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Prazo</span>
                <span className="font-medium text-gray-700">{formatDate(ticket.sla_deadline)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', sla >= 90 ? 'bg-red-500' : sla >= 70 ? 'bg-amber-400' : 'bg-[#185FA5]')}
                  style={{ width: `${sla}%` }} />
              </div>
              <div className="text-xs text-gray-400 text-right">{sla}% do tempo</div>
              <div className="border-t border-gray-100 pt-3 space-y-2">
                {[
                  ['Abertura',     formatDate(ticket.created_at)],
                  ['1ª resposta',  ticket.first_response_at ? formatDate(ticket.first_response_at) : 'Pendente'],
                  ['Tempo aberto', formatDuration(ticket.open_seconds)],
                  ['Fechamento',   ticket.closed_at ? formatDate(ticket.closed_at) : '—'],
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
              <Link href={`/empresas/${ticket.company_id}`} className="btn btn-sm text-xs">Ver</Link>
            </div>
            <div className="card-body space-y-2">
              {[
                ['Razão social', ticket.company_legal_name],
                ['Cidade',       `${ticket.company_city}/${ticket.company_state}`],
                ['Parceiro',     ticket.partner_name ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-400">{k}</span>
                  <span className="font-medium text-gray-700 text-right max-w-[150px] truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

          {/* Anexos */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Paperclip size={14} /> Anexos</span>
              <span className="text-xs text-gray-400">{attachments.length} arquivo(s)</span>
            </div>
            <div className="card-body">
              <FileUpload
                ticketId={id}
                existingAttachments={attachments}
                onUploaded={att => setAttachments(prev => [...prev, att])}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ALLOWED_TRANSITIONS_LABELS: Record<string, string> = {
  aberto:             'Aberto',
  em_analise:         'Em análise',
  encaminhado:        'Encaminhado',
  em_andamento:       'Em andamento',
  aguardando_retorno: 'Aguardando retorno',
  finalizado:         'Finalizado',
  cancelado:          'Cancelado',
}
