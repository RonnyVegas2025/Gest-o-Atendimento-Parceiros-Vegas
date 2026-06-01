'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PriorityBadge } from '@/components/tickets/StatusBadge'
import { formatDateShort } from '@/lib/utils'
import { DEPARTMENT_LABELS } from '@/lib/constants'
import Link from 'next/link'
import { Plus, Zap, AlertTriangle, Clock, Building2 } from 'lucide-react'
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

function getSlaUrgency(ticket: any): number {
  if (!ticket.sla_deadline) return 0
  if (ticket.sla_breached) return 4
  const total = new Date(ticket.sla_deadline).getTime() - new Date(ticket.created_at).getTime()
  const remaining = new Date(ticket.sla_deadline).getTime() - Date.now()
  const pct = remaining / total
  if (pct <= 0.1) return 3
  if (pct <= 0.3) return 2
  return 1
}

function formatRemaining(ticket: any): { text: string; cls: string } | null {
  if (!ticket.sla_deadline) return null
  const ms = new Date(ticket.sla_deadline).getTime() - Date.now()
  if (ms < 0) return { text: 'Vencido', cls: 'text-red-600 font-bold' }
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return { text: `${Math.floor(h/24)}d ${h%24}h`, cls: 'text-gray-500' }
  if (h >= 8)  return { text: `${h}h ${m}min`, cls: 'text-amber-600' }
  return { text: `${h}h ${m}min`, cls: 'text-red-600 font-semibold' }
}

function SlaBar({ ticket }: { ticket: any }) {
  if (!ticket.sla_deadline) return <span className="text-xs text-gray-300">—</span>
  const total   = new Date(ticket.sla_deadline).getTime() - new Date(ticket.created_at).getTime()
  const elapsed = Date.now() - new Date(ticket.created_at).getTime()
  const pct     = Math.min(100, Math.round((elapsed / total) * 100))
  const color   = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-blue-400'
  const rem     = formatRemaining(ticket)
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: pct + '%' }} />
      </div>
      {rem && <span className={`text-[10px] ${rem.cls}`}>{rem.text}</span>}
    </div>
  )
}

// ✅ Badge de empresa sem cadastro
function SemCadastroBadge() {
  return (
    <span
      title="Empresa digitada livremente — sem cadastro formal. Clique em Empresas para cadastrar."
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 cursor-help"
    >
      <Building2 size={9} />
      Sem cadastro
    </span>
  )
}

export default function AtendimentosPage() {
  const supabase = createClient()
  const [tickets, setTickets]       = useState<any[]>([])
  const [attendants, setAttendants] = useState<{id:string;full_name:string}[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [department, setDepartment] = useState('')
  const [attendant, setAttendant]   = useState('')

  useEffect(() => {
    supabase.from('attendants').select('id, full_name').eq('active', true).order('full_name')
      .then(({ data }) => setAttendants((data as any[]) ?? []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('tickets_with_details')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (status)     query = query.eq('status', status)
      if (department) query = query.eq('department', department)
      if (attendant)  query = query.eq('attendant_id', attendant)
      if (search)     query = query.or(
        `protocol.ilike.%${search}%,company_legal_name.ilike.%${search}%,company_name_free.ilike.%${search}%,requester_name.ilike.%${search}%`
      )

      const { data } = await query
      setTickets((data as any[]) ?? [])
      setLoading(false)
    }
    load()
  }, [status, department, search, attendant])

  const drafts = tickets.filter(t => t.status === 'rascunho')
  const active = tickets.filter(t => !['rascunho','finalizado','cancelado'].includes(t.status))
  const closed = tickets.filter(t => ['finalizado','cancelado'].includes(t.status))

  const activeSorted = useMemo(() => [...active].sort((a, b) => {
    const ua = getSlaUrgency(a)
    const ub = getSlaUrgency(b)
    if (ua !== ub) return ub - ua
    if (a.sla_deadline && b.sla_deadline) {
      return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }), [active])

  function getUrgencyRow(ticket: any): string {
    const u = getSlaUrgency(ticket)
    if (u === 4) return 'bg-red-50 border-l-4 border-l-red-500'
    if (u === 3) return 'bg-orange-50 border-l-4 border-l-orange-400'
    if (u === 2) return 'bg-amber-50/50 border-l-4 border-l-amber-300'
    return ''
  }

  // ✅ Mostra nome + badge se empresa sem cadastro
  function CompanyCell({ ticket }: { ticket: any }) {
    const semCadastro = !ticket.company_id && !!ticket.company_name_free
    const nome = ticket.company_name_free ?? ticket.company_legal_name ?? 'Empresa nao informada'
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{nome}</span>
          {semCadastro && <SemCadastroBadge />}
        </div>
        <div className="text-xs text-gray-400 truncate">{ticket.type_name ?? ticket.type ?? '—'}</div>
      </div>
    )
  }

  const getTypeName = (t: any) => t.type_name ?? t.type ?? '—'
  const COLS = '130px 1fr 140px 110px 110px 100px 130px 90px'

  // ✅ Conta quantos tickets têm empresa sem cadastro (para alerta no topo)
  const semCadastroCount = tickets.filter(t => !t.company_id && !!t.company_name_free).length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Atendimentos</h1>
          <p className="text-xs text-gray-400 mt-0.5">{activeSorted.length} em aberto · {closed.length} concluidos</p>
        </div>
        <Link href="/atendimentos/novo" className="btn-primary">
          <Plus size={15} /> Novo atendimento
        </Link>
      </div>

      {/* ✅ Alerta de empresas sem cadastro */}
      {semCadastroCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <Building2 size={15} className="flex-shrink-0 text-amber-500" />
          <span>
            <strong>{semCadastroCount} atendimento{semCadastroCount > 1 ? 's' : ''}</strong> com empresa sem cadastro formal.{' '}
            <Link href="/empresas" className="underline font-semibold hover:text-amber-900">
              Ir para Empresas para cadastrar →
            </Link>
          </span>
        </div>
      )}

      {/* Rascunhos */}
      {drafts.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <div className="card-header border-amber-100">
            <span className="card-title text-amber-700">
              <Zap size={14} className="text-amber-500" />
              Pre-atendimentos ({drafts.length})
            </span>
            <span className="text-xs text-amber-600">Clique para completar os dados</span>
          </div>
          {drafts.map(ticket => {
            const semCadastro = !ticket.company_id && !!ticket.company_name_free
            const nome = ticket.company_name_free ?? ticket.company_legal_name ?? 'Empresa nao informada'
            return (
              <Link key={ticket.id} href={`/atendimentos/${ticket.id}`}
                className="table-row grid hover:bg-amber-50"
                style={{ gridTemplateColumns: '130px 1fr 110px 90px 130px 90px' }}>
                <span className="font-mono text-xs text-gray-400">{ticket.protocol}</span>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{nome}</span>
                    {semCadastro && <SemCadastroBadge />}
                  </div>
                  <div className="text-xs text-gray-400">{ticket.requester_name}</div>
                </div>
                <span className="text-xs text-gray-500">{(DEPARTMENT_LABELS as any)[ticket.department] ?? ticket.department}</span>
                <PriorityBadge priority={ticket.priority} />
                <span className={cn('badge', STATUS_BADGE['rascunho'])}>Rascunho</span>
                <span className="text-xs text-gray-400">{formatDateShort(ticket.created_at)}</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input max-w-xs" placeholder="Buscar por empresa, protocolo, solicitante..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="em_analise">Em analise</option>
          <option value="em_andamento">Em andamento</option>
          <option value="encaminhado">Encaminhado</option>
          <option value="aguardando_retorno">Aguardando</option>
          <option value="finalizado">Finalizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select className="select w-40" value={department} onChange={e => setDepartment(e.target.value)}>
          <option value="">Todos os depto.</option>
          <option value="comercial">ADM Comercial</option>
          <option value="operacional">Operacional</option>
          <option value="cadastro">Cadastro</option>
          <option value="financeiro">Financeiro</option>
          <option value="rede">Rede</option>
          <option value="marketing">Marketing</option>
          <option value="juridico">Juridico</option>
          <option value="logistica">Logistica</option>
        </select>
        <select className="select w-40" value={attendant} onChange={e => setAttendant(e.target.value)}>
          <option value="">Todos os atend.</option>
          {attendants.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>

      {/* Legenda SLA */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"/>SLA vencido</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block"/>Critico (&lt;10%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block"/>Atencao (&lt;30%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block"/>Normal</span>
      </div>

      {/* Lista ativa */}
      <div className="card overflow-hidden">
        <div className="table-header grid text-xs" style={{ gridTemplateColumns: COLS }}>
          <span>Protocolo</span>
          <span>Empresa / Tipo</span>
          <span>Atendente</span>
          <span>Departamento</span>
          <span>SLA restante</span>
          <span>Prioridade</span>
          <span>Status</span>
          <span>Abertura</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : activeSorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum atendimento em aberto</div>
        ) : activeSorted.map(ticket => (
          <Link key={ticket.id} href={`/atendimentos/${ticket.id}`}
            className={cn('table-row grid hover:brightness-95 transition-all', getUrgencyRow(ticket))}
            style={{ gridTemplateColumns: COLS }}>
            <div className="flex items-center gap-1.5">
              {ticket.sla_breached && <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />}
              <span className="font-mono text-xs text-gray-400">{ticket.protocol}</span>
            </div>
            <CompanyCell ticket={ticket} />
            <span className="text-xs text-gray-600 truncate self-center">{ticket.attendant_name ?? '—'}</span>
            <span className="text-xs text-gray-500 self-center">{(DEPARTMENT_LABELS as any)[ticket.department] ?? ticket.department}</span>
            <div className="self-center w-full pr-2">
              <SlaBar ticket={ticket} />
            </div>
            <div className="self-center"><PriorityBadge priority={ticket.priority} /></div>
            <span className={cn('badge self-center', STATUS_BADGE[ticket.status] ?? 'bg-gray-100 text-gray-600')}>
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </span>
            <span className="text-xs text-gray-400 self-center">{formatDateShort(ticket.created_at)}</span>
          </Link>
        ))}
      </div>

      {/* Concluídos */}
      {closed.length > 0 && (
        <div className="card opacity-70">
          <div className="card-header bg-gray-50">
            <span className="card-title text-gray-400">Concluidos e cancelados ({closed.length})</span>
          </div>
          <div className="table-header grid text-xs" style={{ gridTemplateColumns: COLS }}>
            <span>Protocolo</span><span>Empresa / Tipo</span><span>Atendente</span>
            <span>Departamento</span><span>Tempo total</span><span>Prioridade</span>
            <span>Status</span><span>Encerrado</span>
          </div>
          {closed.map(ticket => {
            const semCadastro = !ticket.company_id && !!ticket.company_name_free
            const nome = ticket.company_name_free ?? ticket.company_legal_name ?? 'Empresa nao informada'
            return (
              <Link key={ticket.id} href={`/atendimentos/${ticket.id}`}
                className="table-row grid hover:bg-gray-50/50"
                style={{ gridTemplateColumns: COLS }}>
                <span className="font-mono text-xs text-gray-300">{ticket.protocol}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm text-gray-400 truncate">{nome}</span>
                    {semCadastro && <SemCadastroBadge />}
                  </div>
                  <div className="text-xs text-gray-300 truncate">{getTypeName(ticket)}</div>
                </div>
                <span className="text-xs text-gray-400 self-center">{ticket.attendant_name ?? '—'}</span>
                <span className="text-xs text-gray-400 self-center">{(DEPARTMENT_LABELS as any)[ticket.department] ?? ticket.department}</span>
                <span className="text-xs text-gray-400 self-center">
                  {ticket.open_seconds > 0
                    ? ticket.open_seconds >= 3600
                      ? `${Math.floor(ticket.open_seconds/3600)}h ${Math.floor((ticket.open_seconds%3600)/60)}min`
                      : `${Math.floor(ticket.open_seconds/60)}min`
                    : '—'}
                </span>
                <div className="self-center"><PriorityBadge priority={ticket.priority} /></div>
                <span className={cn('badge self-center', STATUS_BADGE[ticket.status] ?? 'bg-gray-100 text-gray-600')}>
                  {STATUS_LABEL[ticket.status] ?? ticket.status}
                </span>
                <span className="text-xs text-gray-300 self-center">
                  {ticket.closed_at ? formatDateShort(ticket.closed_at) : formatDateShort(ticket.created_at)}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
