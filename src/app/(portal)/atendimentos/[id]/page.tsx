'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, timeAgo, formatDuration } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_DOT } from '@/lib/constants'
import type { TicketWithDetails, TicketHistory, Company } from '@/lib/types'
import { ArrowLeft, Clock, Building2, Send, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Search, Zap, Edit2 } from 'lucide-react'
import PasteTextarea from '@/components/ui/PasteTextarea'
import Link from 'next/link'

const DEPARTMENTS = [
  { value: 'comercial',   label: 'ADM Comercial' },
  { value: 'cadastro',    label: 'Cadastro' },
  { value: 'financeiro',  label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'rede',        label: 'Rede' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'juridico',    label: 'Juridico' },
  { value: 'logistica',   label: 'Logistica' },
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

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  aberto: [{ value: 'em_analise', label: 'Iniciar analise' }],
  em_analise: [
    { value: 'em_andamento',       label: 'Colocar em andamento' },
    { value: 'encaminhado',        label: 'Encaminhar para depto' },
    { value: 'aguardando_retorno', label: 'Aguardar retorno' },
    { value: 'finalizado',         label: 'Finalizar atendimento' },
  ],
  encaminhado: [
    { value: 'em_andamento',       label: 'Depto concluiu - retomar ADM Comercial' },
    { value: 'encaminhado',        label: 'Reencaminhar para outro depto' },
    { value: 'aguardando_retorno', label: 'Aguardar retorno' },
    { value: 'finalizado',         label: 'Finalizar diretamente' },
  ],
  em_andamento: [
    { value: 'finalizado',         label: 'Finalizar atendimento' },
    { value: 'encaminhado',        label: 'Encaminhar para depto' },
    { value: 'aguardando_retorno', label: 'Aguardar retorno cliente' },
  ],
  aguardando_retorno: [
    { value: 'em_andamento', label: 'Cliente retornou - retomar' },
    { value: 'encaminhado',  label: 'Encaminhar para depto' },
    { value: 'finalizado',   label: 'Finalizar atendimento' },
  ],
  rascunho: [],
  finalizado: [],
  cancelado:  [],
}

const STATUS_TRANS: Record<string, string> = {
  rascunho: 'Rascunho', aberto: 'Aberto', em_analise: 'Em analise',
  encaminhado: 'Encaminhado', em_andamento: 'Em andamento',
  aguardando_retorno: 'Aguardando retorno', finalizado: 'Finalizado', cancelado: 'Cancelado',
}

const TL_COLORS: Record<string, string> = {
  aberto: 'bg-blue-500', em_analise: 'bg-amber-400', encaminhado: 'bg-purple-500',
  em_andamento: 'bg-green-500', aguardando_retorno: 'bg-gray-400',
  finalizado: 'bg-green-600', cancelado: 'bg-red-500', rascunho: 'bg-amber-300',
}

const TYPE_LABELS: Record<string, string> = {
  segunda_via_cartao: 'Segunda via cartao', inclusao_colaborador: 'Inclusao colaborador',
  exclusao_colaborador: 'Exclusao colaborador', alteracao_cadastro: 'Alteracao cadastro',
  problema_saldo: 'Problema saldo', problema_cartao: 'Problema cartao', outros: 'Outros',
}

const PRIORITY_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Media', alta: 'Alta' }

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [history, setHistory] = useState<TicketHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState('')
  const [actionDept, setActionDept] = useState('')
  const [actionObs, setActionObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [obsText, setObsText] = useState('')
  const [savingObs, setSavingObs] = useState(false)

  // Completar rascunho
  const [companies, setCompanies] = useState<Company[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [editRequester, setEditRequester] = useState('')
  const [editEmployee, setEditEmployee] = useState('')
  const [editDept, setEditDept] = useState('comercial')
  const [editPriority, setEditPriority] = useState('media')
  const [completing, setCompleting] = useState(false)

  useEffect(() => { fetchData() }, [id])

  useEffect(() => {
    Promise.all([
      supabase.from('companies').select('id, legal_name, trade_name, cnpj').eq('status', 'ativa').order('legal_name'),
      supabase.from('empresas_conveniadas').select('id, nome_fantasia, razao_social, cnpj').eq('ativo', true).order('nome_fantasia')
    ]).then(([{ data: comp }, { data: conv }]) => {
      const fromCompanies = (comp ?? []).map((c: any) => ({ id: c.id, legal_name: c.legal_name, trade_name: c.trade_name, cnpj: c.cnpj }))
      const fromConveniadas = (conv ?? []).map((c: any) => ({ id: c.id, legal_name: c.nome_fantasia, trade_name: c.razao_social || c.nome_fantasia, cnpj: c.cnpj }))
      const all = [...fromCompanies, ...fromConveniadas]
      setCompanies(all as any)
      setFilteredCompanies(all as any)
    })
  }, [])

  useEffect(() => {
    if (!companySearch || companySearch.length < 2) { setFilteredCompanies([]); return }
    const q = companySearch.toLowerCase()
    const digits = companySearch.replace(/\D/g, '')
    setFilteredCompanies(companies.filter((c: any) =>
      (c.legal_name ?? '').toLowerCase().includes(q) ||
      (c.trade_name ?? '').toLowerCase().includes(q) ||
      (digits.length >= 3 && (c.cnpj ?? '').includes(digits))
    ))
  }, [companySearch, companies])

  async function fetchData() {
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from('tickets_with_details').select('*').eq('id', id).single(),
      supabase.from('ticket_history').select('*, user:user_id(full_name)').eq('ticket_id', id).order('created_at', { ascending: true }),
    ])
    setTicket(t as TicketWithDetails)
    setHistory((h as TicketHistory[]) ?? [])
    setLoading(false)
    if (t) {
      setActionDept((t as any).department)
      setEditRequester((t as any).requester_name ?? '')
      setEditEmployee((t as any).employee_name ?? '')
      setEditDept((t as any).department ?? 'comercial')
      setEditPriority((t as any).priority ?? 'media')
    }
  }

  async function completeRascunho() {
    setCompleting(true)
    const updates: Record<string, unknown> = {
      status: 'aberto',
      requester_name: editRequester || 'Nao informado',
      employee_name: editEmployee || null,
      department: editDept,
      priority: editPriority,
    }
    if (selectedCompany) updates.company_id = selectedCompany.id

    await supabase.from('tickets').update(updates).eq('id', id)
    await supabase.from('ticket_history').insert({
      ticket_id: id,
      action: 'Pre-atendimento convertido em atendimento oficial' + (selectedCompany ? ' - Empresa: ' + (selectedCompany.trade_name || selectedCompany.legal_name) : ''),
      to_status: 'aberto',
      user_id: '00000000-0000-0000-0000-000000000001',
    })
    setCompleting(false)
    fetchData()
  }

  async function handleAction() {
    if (!actionStatus) return
    setSaving(true)
    const isForwarding = actionStatus === 'encaminhado'
    const isReturning = actionStatus === 'em_andamento' && ticket?.status === 'encaminhado'
    const deptLabel = DEPARTMENTS.find(d => d.value === actionDept)?.label ?? actionDept
    const statusLabel = STATUS_TRANS[actionStatus] ?? actionStatus
    let actionText = 'Status alterado para "' + statusLabel + '"'
    if (isForwarding) actionText = 'Encaminhado para: ' + deptLabel
    if (isReturning)  actionText = deptLabel + ' concluiu - retomado pelo ADM Comercial'
    if (actionObs) actionText += ' - ' + actionObs
    const updatePayload: Record<string, string> = { status: actionStatus }
    if (isForwarding) updatePayload.department = actionDept
    if (isReturning)  updatePayload.department = 'comercial'
    await supabase.from('tickets').update(updatePayload).eq('id', id)
    await supabase.from('ticket_history').insert({
      ticket_id: id, action: actionText, observation: actionObs || null,
      from_status: ticket?.status, to_status: actionStatus,
      user_id: '00000000-0000-0000-0000-000000000001',
    })
    setActionStatus(''); setActionObs(''); setSaving(false)
    fetchData()
  }

  async function handleObs() {
    if (!obsText.trim()) return
    setSavingObs(true)
    await supabase.from('ticket_history').insert({
      ticket_id: id, action: obsText.trim(), observation: obsText.trim(),
      user_id: '00000000-0000-0000-0000-000000000001',
    })
    setObsText(''); setSavingObs(false); fetchData()
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

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!ticket) return <div className="p-6 text-sm text-red-500">Atendimento nao encontrado.</div>

  const isDraft = ticket.status === 'rascunho'
  const isClosed = ['finalizado', 'cancelado'].includes(ticket.status)
  const nextActions = NEXT_STATUSES[ticket.status] ?? []
  const currentDeptLabel = DEPARTMENTS.find(d => d.value === ticket.department)?.label ?? ticket.department
  const slaTotal = ticket.sla_deadline ? (new Date(ticket.sla_deadline).getTime() - new Date(ticket.created_at).getTime()) / 1000 : 0
  const sla = slaTotal > 0 ? Math.min(100, Math.round((ticket.open_seconds / slaTotal) * 100)) : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/atendimentos" className="btn btn-sm"><ArrowLeft size={14} /></Link>
        <span className="font-mono text-sm text-gray-400">{ticket.protocol}</span>
        <span className={cn('badge', STATUS_COLORS[ticket.status])}>{STATUS_LABELS[ticket.status]}</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[ticket.priority])} />
          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
        </span>
        <span className={cn('badge', DEPT_COLORS[ticket.department] ?? 'bg-gray-100 text-gray-600')}>
          {currentDeptLabel}
        </span>
        {ticket.sla_breached && (
          <span className="badge bg-red-50 text-red-600 border border-red-200">
            <AlertTriangle size={11} /> SLA vencido
          </span>
        )}
      </div>

      {/* Banner rascunho */}
      {isDraft && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <Zap size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-amber-700">Pre-atendimento - dados incompletos</div>
            <div className="text-xs text-amber-600 mt-0.5">Complete as informacoes abaixo para converter em atendimento oficial.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5">

          {/* Completar rascunho */}
          {isDraft && (
            <div className="card border-amber-200">
              <div className="card-header border-amber-100 bg-amber-50/50">
                <span className="card-title text-amber-700"><Edit2 size={14} /> Completar dados</span>
              </div>
              <div className="card-body space-y-4">
                {/* Empresa */}
                <div className="form-group">
                  <label className="form-label">Empresa</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9" placeholder="Digite o nome ou CNPJ da empresa..."
                      value={companySearch}
                      onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true); setSelectedCompany(null) }}
                      onFocus={() => setShowDropdown(true)} />
                  </div>
                  {showDropdown && !selectedCompany && companySearch && (
                    <div className="border border-gray-200 rounded-xl shadow-lg mt-1 bg-white max-h-48 overflow-y-auto z-10 relative">
                      {filteredCompanies.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Nenhuma empresa encontrada</div>
                      ) : filteredCompanies.slice(0, 6).map(c => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => { setSelectedCompany(c); setCompanySearch(c.trade_name || c.legal_name); setShowDropdown(false) }}>
                          <div className="text-sm font-medium text-gray-900">{c.trade_name || c.legal_name}</div>
                          <div className="text-xs text-gray-400 font-mono">{c.cnpj}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedCompany && <p className="text-xs text-green-600 mt-1">Selecionado: {selectedCompany.legal_name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Solicitante (RH)</label>
                    <input className="input" value={editRequester} onChange={e => setEditRequester(e.target.value)} placeholder="Nome do RH" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Colaborador</label>
                    <input className="input" value={editEmployee} onChange={e => setEditEmployee(e.target.value)} placeholder="Nome do funcionario" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Departamento</label>
                    <select className="select" value={editDept} onChange={e => setEditDept(e.target.value)}>
                      {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prioridade</label>
                    <select className="select" value={editPriority} onChange={e => setEditPriority(e.target.value)}>
                      <option value="baixa">Baixa</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                <button onClick={completeRascunho} disabled={completing} className="btn-primary w-full justify-center">
                  <CheckCircle2 size={15} />
                  {completing ? 'Convertendo...' : 'Converter em atendimento oficial'}
                </button>
              </div>
            </div>
          )}

          {/* Informacoes */}
          <div className="card">
            <div className="card-header"><span className="card-title">Informacoes</span></div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                <div><div className="text-xs text-gray-400 mb-0.5">Empresa</div><div className="text-sm font-medium text-gray-900">{ticket.company_legal_name ?? (ticket as any).company_name_free ?? 'Não informada'}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Solicitante</div><div className="text-sm font-medium text-gray-900">{ticket.requester_name}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Colaborador</div><div className="text-sm font-medium text-gray-900">{ticket.employee_name ?? '—'}</div></div>
               <div><div className="text-xs text-gray-400 mb-0.5">Tipo</div><div className="text-sm font-medium text-gray-900">{(ticket as any).type_name ?? TYPE_LABELS[ticket.type] ?? ticket.type}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Departamento</div><div className="text-sm font-medium text-gray-900">{currentDeptLabel}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Parceiro</div><div className="text-sm font-medium text-gray-900">{ticket.partner_name ?? '—'}</div></div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-2">Descricao</div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed">{ticket.description}</div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Timeline</span>
              <span className="text-xs text-gray-400">{history.length} eventos</span>
            </div>
            <div className="card-body">
              {history.length > 0 ? (
                <ol className="relative pl-6 border-l border-gray-100 space-y-5 mb-6">
                  {history.map((item, idx) => {
                    const dot = item.to_status ? (TL_COLORS[item.to_status] ?? 'bg-gray-300') : (idx === 0 ? 'bg-blue-500' : 'bg-gray-300')
                    const userName = (item.user as any)?.full_name ?? 'Sistema'
                    return (
                      <li key={item.id} className="relative">
                        <span className={cn('absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white', dot)} />
                        <div className="text-sm font-medium text-gray-900">{item.action}</div>
                        {item.observation && item.observation !== item.action && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg mt-1">{item.observation}</div>
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
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-medium text-gray-600 mb-2">Adicionar observacao</div>
                <PasteTextarea value={obsText} onChange={setObsText}
                  placeholder="Descreva uma atualizacao — use Ctrl+V para colar prints..." rows={2} />
                <div className="flex justify-end mt-2">
                  <button onClick={handleObs} disabled={!obsText.trim() || savingObs} className="btn-primary btn-sm">
                    <Send size={13} /> {savingObs ? 'Registrando...' : 'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Acoes</span></div>
            <div className="card-body space-y-3">
              {isDraft ? (
                <div className="text-xs text-amber-600 text-center py-2 bg-amber-50 rounded-lg border border-amber-100">
                  Complete os dados ao lado para liberar as acoes
                </div>
              ) : isClosed ? (
                <p className="text-xs text-gray-400 text-center py-2">Atendimento encerrado</p>
              ) : (
                <>
                  {nextActions.map(action => (
                    <button key={action.value}
                      onClick={() => setActionStatus(prev => prev === action.value ? '' : action.value)}
                      className={cn('w-full justify-center text-sm', actionStatus === action.value ? 'btn-primary' : 'btn')}>
                      {action.value === 'finalizado' && <CheckCircle2 size={14} />}
                      {action.value === 'encaminhado' && <ArrowRight size={14} />}
                      {action.label}
                    </button>
                  ))}
                  {actionStatus === 'encaminhado' && (
                    <div className="space-y-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <div className="text-xs font-medium text-purple-700">Encaminhar para qual departamento?</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DEPARTMENTS.map(d => (
                          <button key={d.value} type="button" onClick={() => setActionDept(d.value)}
                            className={cn('text-xs px-2 py-1.5 rounded-lg border transition-colors text-left',
                              actionDept === d.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300')}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {actionStatus && (
                    <PasteTextarea value={actionObs} onChange={setActionObs}
                      placeholder="Observacao sobre esta acao (opcional)..." rows={2} />
                  )}
                  {actionStatus && (
                    <button onClick={handleAction} disabled={saving} className="btn-primary w-full justify-center">
                      <CheckCircle2 size={14} /> {saving ? 'Salvando...' : 'Confirmar acao'}
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
          {!isDraft && (
            <div className="card">
              <div className="card-header"><span className="card-title"><Clock size={14} /> SLA</span></div>
              <div className="card-body space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Prazo</span>
                  <span className="font-medium text-gray-700">{formatDate(ticket.sla_deadline)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', sla >= 90 ? 'bg-red-500' : sla >= 70 ? 'bg-amber-400' : 'bg-[#185FA5]')} style={{ width: sla + '%' }} />
                </div>
                <div className="text-xs text-gray-400 text-right">{sla}% do tempo</div>
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Abertura</span><span className="font-medium text-gray-700">{formatDate(ticket.created_at)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">1a resposta</span><span className="font-medium text-gray-700">{ticket.first_response_at ? formatDate(ticket.first_response_at) : 'Pendente'}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Tempo aberto</span><span className="font-medium text-gray-700">{formatDuration(ticket.open_seconds)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Fechamento</span><span className="font-medium text-gray-700">{ticket.closed_at ? formatDate(ticket.closed_at) : '—'}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Empresa */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Building2 size={14} /> Empresa</span>
              {!isDraft && ticket.company_id && <Link href={'/empresas/' + ticket.company_id} className="btn btn-sm text-xs">Ver</Link>}
            </div>
            <div className="card-body space-y-2">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Razao social</span><span className="font-medium text-gray-700 text-right max-w-[150px] truncate">{ticket.company_legal_name}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Cidade</span><span className="font-medium text-gray-700">{ticket.company_city && ticket.company_state ? ticket.company_city + '/' + ticket.company_state : '—'}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Parceiro</span><span className="font-medium text-gray-700">{ticket.partner_name ?? '—'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
