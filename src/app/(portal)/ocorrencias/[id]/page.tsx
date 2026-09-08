'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Check, Clock, Wrench, Search, X, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDepartments } from '@/hooks/useDepartments'
import { STATUS_OCORRENCIA, IMPACTO_OCORRENCIA } from '@/lib/constants'
import StatusHelp from '@/components/ocorrencias/StatusHelp'
import ImpactoHelp from '@/components/ocorrencias/ImpactoHelp'
import PasteTextarea from '@/components/ui/PasteTextarea'

/*
 * DETALHE DA OCORRÊNCIA — edição completa de todos os campos + histórico.
 * Reutiliza os padrões da tela de registro (autocomplete de empresa, filtro de
 * tipo_erro por departamento, PasteTextarea). Sem exclusão. Protocolo,
 * created_by e created_at não são editáveis.
 * Histórico gravado em `ocorrencia_historico` (campo/valor_anterior/valor_novo/
 * alterado_por/alterado_em) — rótulos legíveis, um registro por campo alterado.
 */

const GRAV_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
const GRAVIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta',  label: 'Alta' },
]

const normalizeText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('pt-BR')
}
function fmtDateTime(d: string | null) {
  return d ? new Date(d).toLocaleString('pt-BR') : '—'
}
// Rótulo de valor de texto longo para o histórico: 200 chars + reticências.
function trunc(s: string | null): string {
  const t = (s ?? '').trim()
  if (!t) return '—'
  return t.length > 200 ? t.slice(0, 200) + '…' : t
}
const disp = (s: string | null | undefined) => (s && String(s).trim() ? String(s) : '—')

interface TipoErro { id: string; department: string; nome: string; active: boolean }
interface HistoricoItem {
  id: string; campo: string; valor_anterior: string | null; valor_novo: string | null
  alterado_por: string | null; alterado_em: string
}

export default function OcorrenciaDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { departments, deptLabels, loading: deptLoading } = useDepartments()

  const [o, setO] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [okMsg, setOkMsg] = useState(false)
  const [error, setError] = useState('')
  const [solError, setSolError] = useState('')

  // Usuário logado + listas de apoio
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [usuarios, setUsuarios] = useState<{ id: string; full_name: string }[]>([])
  const usersMap = useMemo(() => Object.fromEntries(usuarios.map(u => [u.id, u.full_name])), [usuarios])
  const [tiposMap, setTiposMap] = useState<Record<string, string>>({})

  // Tipos de erro do departamento selecionado
  const [tiposErro, setTiposErro] = useState<TipoErro[]>([])
  const [loadingTipos, setLoadingTipos] = useState(false)

  // Empresa (autocomplete)
  const [companies, setCompanies] = useState<{ id: string; legal_name: string; trade_name: string; cnpj: string }[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; legal_name: string; trade_name: string } | null>(null)
  const [showCompanyDrop, setShowCompanyDrop] = useState(false)
  const companyBoxRef = useRef<HTMLDivElement>(null)

  // Atendimento relacionado (busca por protocolo)
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketResults, setTicketResults] = useState<{ id: string; protocol: string }[]>([])
  const [selectedTicket, setSelectedTicket] = useState<{ id: string; protocol: string } | null>(null)
  const [showTicketDrop, setShowTicketDrop] = useState(false)
  const ticketBoxRef = useRef<HTMLDivElement>(null)

  const [obsImgs, setObsImgs] = useState<string[]>([])
  const [solImgs, setSolImgs] = useState<string[]>([])
  const [registradoPor, setRegistradoPor] = useState<string>('—')
  const [historico, setHistorico] = useState<HistoricoItem[]>([])

  const [form, setForm] = useState({
    department: '', tipo_erro_id: '', titulo: '', observacao: '',
    gravidade: 'media', impacto: '', data_ocorrencia: '',
    responsavel_id: '', status: 'aberta', solucao: '', resolvido_por: '',
  })
  function set(field: string, value: string) { setForm(p => ({ ...p, [field]: value })) }

  useEffect(() => { fetchData(); fetchHistorico() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  // Usuário logado + usuários + mapa de tipos + empresas (autocomplete)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users_profile').select('id').eq('email', user.email ?? '').maybeSingle()
      if ((data as any)?.id) setCurrentUserId((data as any).id)
    })
    supabase.from('users_profile').select('id, full_name').order('full_name')
      .then(({ data }) => setUsuarios((data as any[]) ?? []))
    supabase.from('tipos_erro').select('id, nome')
      .then(({ data }) => setTiposMap(Object.fromEntries(((data as any[]) ?? []).map(t => [t.id, t.nome]))))
    Promise.all([
      supabase.from('companies').select('id, legal_name, trade_name, cnpj').eq('status', 'ativa').order('legal_name'),
      supabase.from('empresas_conveniadas').select('id, nome_fantasia, razao_social, cnpj').eq('ativo', true).order('nome_fantasia').limit(5000),
    ]).then(([{ data: comp }, { data: conv }]) => {
      const a = (comp ?? []).map((c: any) => ({ id: c.id, legal_name: c.legal_name, trade_name: c.trade_name, cnpj: c.cnpj }))
      const b = (conv ?? []).map((c: any) => ({ id: c.id, legal_name: c.nome_fantasia, trade_name: c.razao_social || c.nome_fantasia, cnpj: c.cnpj }))
      setCompanies([...a, ...b] as any)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('ocorrencias').select('*').eq('id', id).single()
    const oc = data as any
    setO(oc)
    setLoading(false)
    if (!oc) return

    setForm({
      department: oc.department ?? '',
      tipo_erro_id: oc.tipo_erro_id ?? '',
      titulo: oc.titulo ?? '',
      observacao: oc.observacao ?? '',
      gravidade: oc.gravidade ?? 'media',
      impacto: oc.impacto ?? '',
      data_ocorrencia: (oc.data_ocorrencia ?? '').slice(0, 10),
      responsavel_id: oc.responsavel_id ?? '',
      status: oc.status ?? 'aberta',
      solucao: oc.solucao ?? '',
      resolvido_por: oc.resolvido_por ?? '',
    })
    setObsImgs([])
    setSolImgs([])
    setError(''); setSolError('')

    if (oc.created_by) {
      supabase.from('users_profile').select('full_name').eq('id', oc.created_by).maybeSingle()
        .then(({ data }) => setRegistradoPor((data as any)?.full_name ?? '—'))
    }
    // Empresa: registrada (empresa_id) ou nome livre (empresa_nome)
    if (oc.empresa_id) {
      const resolve = async () => {
        const conv = await supabase.from('empresas_conveniadas').select('nome_fantasia').eq('id', oc.empresa_id).maybeSingle()
        let nome = (conv.data as any)?.nome_fantasia
        if (!nome) {
          const comp = await supabase.from('companies').select('legal_name').eq('id', oc.empresa_id).maybeSingle()
          nome = (comp.data as any)?.legal_name
        }
        setSelectedCompany({ id: oc.empresa_id, legal_name: nome ?? oc.empresa_id, trade_name: nome ?? oc.empresa_id })
        setCompanySearch('')
      }
      resolve()
    } else if (oc.empresa_nome) {
      setSelectedCompany(null)
      setCompanySearch(oc.empresa_nome)
    } else {
      setSelectedCompany(null); setCompanySearch('')
    }
    // Atendimento relacionado
    if (oc.ticket_id) {
      supabase.from('tickets').select('protocol').eq('id', oc.ticket_id).maybeSingle()
        .then(({ data }) => setSelectedTicket({ id: oc.ticket_id, protocol: (data as any)?.protocol ?? 'ver' }))
    } else {
      setSelectedTicket(null); setTicketSearch('')
    }
  }

  async function fetchHistorico() {
    const { data } = await supabase.from('ocorrencia_historico').select('*')
      .eq('ocorrencia_id', id).order('alterado_em', { ascending: false })
    setHistorico((data as HistoricoItem[]) ?? [])
  }

  // Carrega tipos de erro do departamento e limpa o tipo se não pertencer mais a ele
  useEffect(() => {
    if (!form.department) { setTiposErro([]); return }
    let active = true
    setLoadingTipos(true)
    supabase.from('tipos_erro').select('id, department, nome, active')
      .eq('department', form.department).eq('active', true).order('nome')
      .then(({ data }) => {
        if (!active) return
        const list = (data as TipoErro[]) ?? []
        setTiposErro(list)
        setLoadingTipos(false)
        setForm(f => (f.tipo_erro_id && !list.some(t => t.id === f.tipo_erro_id)) ? { ...f, tipo_erro_id: '' } : f)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.department])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (companyBoxRef.current && !companyBoxRef.current.contains(e.target as Node)) setShowCompanyDrop(false)
      if (ticketBoxRef.current && !ticketBoxRef.current.contains(e.target as Node)) setShowTicketDrop(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filteredCompanies = useMemo(() => {
    if (!companySearch || companySearch.length < 2) return []
    const q = normalizeText(companySearch)
    const digits = companySearch.replace(/\D/g, '')
    return companies.filter(c =>
      normalizeText(c.legal_name ?? '').includes(q) ||
      normalizeText(c.trade_name ?? '').includes(q) ||
      (digits.length >= 3 && (c.cnpj ?? '').replace(/\D/g, '').includes(digits))
    ).slice(0, 6)
  }, [companySearch, companies])

  useEffect(() => {
    const q = ticketSearch.trim()
    if (selectedTicket || q.length < 3) { setTicketResults([]); return }
    let active = true
    const t = setTimeout(() => {
      supabase.from('tickets').select('id, protocol').ilike('protocol', `%${q}%`).limit(6)
        .then(({ data }) => { if (active) setTicketResults((data as any[]) ?? []) })
    }, 250)
    return () => { active = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketSearch, selectedTicket])

  async function salvar() {
    if (!o) return
    setError(''); setSolError('')
    if (!form.department) { setError('Selecione o departamento.'); return }
    if (!form.tipo_erro_id) { setError('Selecione o tipo de erro.'); return }
    if (!form.titulo.trim()) { setError('Informe o título específico.'); return }
    if (form.status === 'resolvida' && !form.solucao.trim()) {
      setSolError('Para marcar como Resolvida, descreva a solução aplicada.'); return
    }

    // Valores novos (o que será gravado)
    const newEmpresaId = selectedCompany?.id ?? null
    const newEmpresaNome = !selectedCompany && companySearch.trim() ? companySearch.trim() : null
    const newTicketId = selectedTicket?.id ?? null
    const empresaLabelNovo = selectedCompany ? (selectedCompany.trade_name || selectedCompany.legal_name)
      : (companySearch.trim() || '—')
    const empresaLabelAnt = o.empresa_nome ? o.empresa_nome
      : (o.empresa_id ? (selectedCompany && selectedCompany.id === o.empresa_id ? (selectedCompany.trade_name || selectedCompany.legal_name) : o.empresa_id) : '—')

    const alteradoEm = new Date().toISOString()

    // Compara campo a campo e monta o histórico com RÓTULOS legíveis
    const rows: any[] = []
    const push = (campo: string, mudou: boolean, ant: string, novo: string) => {
      if (mudou) rows.push({ ocorrencia_id: id, campo, valor_anterior: ant, valor_novo: novo, alterado_por: currentUserId || null, alterado_em: alteradoEm })
    }
    const eq = (a: any, b: any) => (a ?? '') === (b ?? '')

    push('Departamento', !eq(o.department, form.department), disp(deptLabels[o.department] ?? o.department), disp(deptLabels[form.department] ?? form.department))
    push('Tipo de erro', !eq(o.tipo_erro_id, form.tipo_erro_id), disp(tiposMap[o.tipo_erro_id]), disp(tiposMap[form.tipo_erro_id]))
    push('Título', !eq((o.titulo ?? '').trim(), form.titulo.trim()), disp(o.titulo), disp(form.titulo.trim()))
    push('Observação', !eq((o.observacao ?? '').trim(), form.observacao.trim()), trunc(o.observacao), trunc(form.observacao))
    push('Gravidade', !eq(o.gravidade, form.gravidade), disp(GRAV_LABEL[o.gravidade] ?? o.gravidade), disp(GRAV_LABEL[form.gravidade] ?? form.gravidade))
    push('Impacto', !eq(o.impacto, form.impacto || null), disp(o.impacto ? (IMPACTO_OCORRENCIA[o.impacto]?.label ?? o.impacto) : ''), disp(form.impacto ? (IMPACTO_OCORRENCIA[form.impacto]?.label ?? form.impacto) : ''))
    push('Data da ocorrência', !eq((o.data_ocorrencia ?? '').slice(0, 10), form.data_ocorrencia), fmtDate(o.data_ocorrencia), fmtDate(form.data_ocorrencia))
    push('Empresa', !eq(`${o.empresa_id ?? ''}|${o.empresa_nome ?? ''}`, `${newEmpresaId ?? ''}|${newEmpresaNome ?? ''}`), disp(empresaLabelAnt), disp(empresaLabelNovo))
    push('Atendimento relacionado', !eq(o.ticket_id, newTicketId), disp(o.ticket_id ? (selectedTicket?.id === o.ticket_id ? selectedTicket?.protocol : o.ticket_id) : ''), disp(selectedTicket?.protocol))
    push('Pessoa responsável', !eq(o.responsavel_id, form.responsavel_id || null), disp(usersMap[o.responsavel_id]), disp(usersMap[form.responsavel_id]))
    push('Status', !eq(o.status, form.status), disp(STATUS_OCORRENCIA[o.status]?.label ?? o.status), disp(STATUS_OCORRENCIA[form.status]?.label ?? form.status))
    push('Solução', !eq((o.solucao ?? '').trim(), form.solucao.trim()), trunc(o.solucao), trunc(form.solucao))

    setSalvando(true)

    const existingImgs: string[] = Array.isArray(o.imagens) ? o.imagens : []
    const mergedImgs = Array.from(new Set([...existingImgs, ...obsImgs]))
    const existingSolImgs: string[] = Array.isArray(o.solucao_imagens) ? o.solucao_imagens : []
    const mergedSolImgs = Array.from(new Set([...existingSolImgs, ...solImgs]))

    const update: Record<string, any> = {
      department: form.department,
      tipo_erro_id: form.tipo_erro_id,
      titulo: form.titulo.trim(),
      observacao: form.observacao.trim() || null,
      gravidade: form.gravidade,
      impacto: form.impacto || null,
      data_ocorrencia: form.data_ocorrencia || null,
      empresa_id: newEmpresaId,
      empresa_nome: newEmpresaNome,
      ticket_id: newTicketId,
      responsavel_id: form.responsavel_id || null,
      status: form.status,
      solucao: form.solucao.trim() || null,
      imagens: mergedImgs.length ? mergedImgs : null,
      solucao_imagens: mergedSolImgs,
      updated_at: alteradoEm,
    }
    // Carimba a resolução apenas na transição para "resolvida" (mantém o histórico ao sair).
    if (form.status === 'resolvida') {
      update.resolvido_por = (form.resolvido_por || currentUserId) || null
      if (o.status !== 'resolvida') update.resolvido_em = alteradoEm
    }

    const { error: err } = await supabase.from('ocorrencias').update(update).eq('id', id)
    if (err) { setSalvando(false); setError(err.message); return }

    if (rows.length > 0) {
      await supabase.from('ocorrencia_historico').insert(rows)
    }

    setSalvando(false)
    setOkMsg(true)
    setTimeout(() => setOkMsg(false), 1500)
    fetchData()
    fetchHistorico()
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!o) return <div className="p-6 text-sm text-red-500">Ocorrência não encontrada.</div>

  const grav = GRAV_LABEL[o.gravidade] ? { label: GRAV_LABEL[o.gravidade] } : { label: o.gravidade }
  const st = STATUS_OCORRENCIA[o.status] ?? { label: o.status, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
  const existingImgs: string[] = Array.isArray(o.imagens) ? o.imagens : []
  const existingSolImgs: string[] = Array.isArray(o.solucao_imagens) ? o.solucao_imagens : []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/ocorrencias" className="btn btn-sm"><ArrowLeft size={14} /></Link>
        <span className="font-mono text-sm text-gray-400">{o.protocolo || '—'}</span>
        <span className={cn('badge', st.badge)}>{st.label}</span>
        <span className="badge bg-gray-100 text-gray-600 border border-gray-200">{grav.label}</span>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-5">
        {/* Coluna principal — edição */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Informações</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Departamento *</label>
                  <select className="select" value={form.department} onChange={e => set('department', e.target.value)} disabled={deptLoading} required>
                    <option value="">Selecione o departamento...</option>
                    {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de erro *</label>
                  <select className="select" value={form.tipo_erro_id} onChange={e => set('tipo_erro_id', e.target.value)}
                    disabled={!form.department || loadingTipos} required>
                    <option value="">
                      {!form.department ? 'Selecione o departamento antes' : loadingTipos ? 'Carregando...' : tiposErro.length === 0 ? 'Nenhum tipo para este departamento' : 'Selecione o tipo de erro...'}
                    </option>
                    {tiposErro.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Título específico *</label>
                <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} required />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Gravidade *</label>
                  <select className="select" value={form.gravidade} onChange={e => set('gravidade', e.target.value)}>
                    {GRAVIDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <div className="flex items-center gap-1.5">
                    <span className="form-label">Impacto</span>
                    <ImpactoHelp />
                  </div>
                  <select className="select" value={form.impacto} onChange={e => set('impacto', e.target.value)}>
                    <option value="">Selecione o impacto...</option>
                    {Object.entries(IMPACTO_OCORRENCIA).map(([v, im]) => <option key={v} value={v}>{im.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Data da ocorrência *</label>
                  <input type="date" className="input" value={form.data_ocorrencia} onChange={e => set('data_ocorrencia', e.target.value)} />
                </div>
              </div>

              {/* Empresa */}
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <div className="relative" ref={companyBoxRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <input className="input pl-9" placeholder="Digite o nome ou CNPJ..." autoComplete="off"
                    value={selectedCompany ? (selectedCompany.trade_name || selectedCompany.legal_name) : companySearch}
                    onChange={e => { setCompanySearch(e.target.value); setSelectedCompany(null); setShowCompanyDrop(true) }}
                    onFocus={() => setShowCompanyDrop(true)} />
                  {(selectedCompany || companySearch) && (
                    <button type="button" onClick={() => { setSelectedCompany(null); setCompanySearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
                  )}
                  {showCompanyDrop && !selectedCompany && filteredCompanies.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 border border-gray-200 rounded-xl shadow-lg bg-white max-h-48 overflow-y-auto">
                      {filteredCompanies.map(c => (
                        <button key={c.id} type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => { setSelectedCompany(c); setShowCompanyDrop(false) }}>
                          <div className="text-sm font-medium text-gray-900">{c.trade_name || c.legal_name}</div>
                          <div className="text-xs text-gray-400 font-mono">{c.cnpj || '—'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Atendimento relacionado */}
              <div className="form-group">
                <label className="form-label">Atendimento relacionado</label>
                <div className="relative" ref={ticketBoxRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <input className="input pl-9" placeholder="Busque pelo protocolo do atendimento..." autoComplete="off"
                    value={selectedTicket ? selectedTicket.protocol : ticketSearch}
                    onChange={e => { setTicketSearch(e.target.value); setSelectedTicket(null); setShowTicketDrop(true) }}
                    onFocus={() => setShowTicketDrop(true)} />
                  {(selectedTicket || ticketSearch) && (
                    <button type="button" onClick={() => { setSelectedTicket(null); setTicketSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
                  )}
                  {showTicketDrop && !selectedTicket && ticketResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 border border-gray-200 rounded-xl shadow-lg bg-white max-h-48 overflow-y-auto">
                      {ticketResults.map(t => (
                        <button key={t.id} type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors font-mono text-sm text-gray-700"
                          onClick={() => { setSelectedTicket(t); setShowTicketDrop(false) }}>{t.protocol}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Responsável */}
              <div className="form-group">
                <label className="form-label">Pessoa responsável</label>
                <select className="select" value={form.responsavel_id} onChange={e => set('responsavel_id', e.target.value)}>
                  <option value="">Selecione a pessoa responsável...</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              {/* Observação */}
              <div className="form-group">
                <label className="form-label">Observação</label>
                <PasteTextarea value={form.observacao} onChange={v => set('observacao', v)} onImagesChange={setObsImgs}
                  placeholder="Descreva o que ocorreu, contexto e evidências. Ctrl+V para colar prints..." rows={4} />
                {existingImgs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-1">Imagens já anexadas ({existingImgs.length}) — novas coladas são adicionadas</div>
                    <div className="flex flex-wrap gap-2">
                      {existingImgs.map((url, i) => (
                        <img key={i} src={url} alt={`Evidência ${i + 1}`}
                          className="h-20 w-auto max-w-[160px] rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                          onClick={() => window.open(url, '_blank')} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Solução aplicada */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Wrench size={14} /> Solução aplicada</span>
              {o.resolvido_em && (
                <span className="text-xs text-gray-400">Resolvido em {fmtDateTime(o.resolvido_em)} · {disp(usersMap[o.resolvido_por])}</span>
              )}
            </div>
            <div className="card-body space-y-4">
              <div className="form-group">
                <label className="form-label">O que foi feito para corrigir{form.status === 'resolvida' ? ' *' : ''}</label>
                <PasteTextarea value={form.solucao} onChange={v => set('solucao', v)} onImagesChange={setSolImgs}
                  placeholder="Descreva a correção da causa (não apenas o caso pontual). Ctrl+V para colar prints..." rows={4} />
                {solError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 mt-1">{solError}</p>}
                {existingSolImgs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-1">Imagens já anexadas ({existingSolImgs.length}) — novas coladas são adicionadas</div>
                    <div className="flex flex-wrap gap-2">
                      {existingSolImgs.map((url, i) => (
                        <img key={i} src={url} alt={`Solução ${i + 1}`}
                          className="h-20 w-auto max-w-[160px] rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                          onClick={() => window.open(url, '_blank')} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Resolvido por</label>
                <select className="select" value={form.resolvido_por || currentUserId} onChange={e => set('resolvido_por', e.target.value)}>
                  <option value="">Selecione...</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — status + salvar + registro */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Status</span></div>
            <div className="card-body space-y-3">
              <div className="form-group">
                <div className="flex items-center gap-1.5">
                  <span className="form-label">Status</span>
                  <StatusHelp />
                </div>
                <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS_OCORRENCIA).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
                {form.status && STATUS_OCORRENCIA[form.status] && (
                  <p className="text-xs text-gray-500 mt-1.5">{STATUS_OCORRENCIA[form.status].descricao}</p>
                )}
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
              <button onClick={salvar} disabled={salvando} className="btn-primary w-full justify-center disabled:opacity-50">
                {salvando ? 'Salvando...' : okMsg ? <><Check size={14} /> Salvo!</> : 'Salvar alterações'}
              </button>
              <p className="text-xs text-gray-400">O registro nunca é excluído. Cada campo alterado fica no histórico abaixo.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title"><Clock size={14} /> Registro</span></div>
            <div className="card-body space-y-2">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Protocolo</span><span className="font-mono text-gray-700">{o.protocolo || '—'}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Registrado por</span><span className="font-medium text-gray-700">{registradoPor}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Aberta em</span><span className="font-medium text-gray-700">{fmtDateTime(o.created_at)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de alterações */}
      <div className="card mt-4">
        <div className="card-header">
          <span className="card-title"><History size={14} /> Histórico de alterações</span>
          <span className="text-xs text-gray-400">{historico.length} registro{historico.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body">
          {historico.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">Nenhuma alteração registrada ainda.</div>
          ) : (
            <ol className="space-y-3">
              {historico.map(h => (
                <li key={h.id} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#185FA5] mt-2 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-800">
                      <span className="font-medium">{h.campo}</span>
                      <span className="text-gray-400"> — de </span>
                      <span className="text-gray-600">“{disp(h.valor_anterior)}”</span>
                      <span className="text-gray-400"> para </span>
                      <span className="text-gray-900 font-medium">“{disp(h.valor_novo)}”</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {disp(usersMap[h.alterado_por ?? ''])} · {fmtDateTime(h.alterado_em)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
