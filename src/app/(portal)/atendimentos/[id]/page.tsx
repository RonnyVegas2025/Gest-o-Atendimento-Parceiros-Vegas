'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, timeAgo, formatDuration } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_DOT } from '@/lib/constants'
import type { TicketWithDetails, TicketHistory, Company } from '@/lib/types'
import { ArrowLeft, Clock, Building2, Send, CheckCircle2, XCircle, AlertTriangle, Search, Zap, Edit2, X, Check, Plus, RefreshCw } from 'lucide-react'
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

const PRODUTOS_OPTIONS = ['Alimentação','Vegas Plus','Vegas Day','Aux. Combustível','Combustível Frota','Farmácia','Cartão Natal']

const DEPT_COLORS: Record<string, string> = {
  comercial: 'bg-blue-100 text-blue-700', cadastro: 'bg-purple-100 text-purple-700',
  financeiro: 'bg-amber-100 text-amber-700', operacional: 'bg-green-100 text-green-700',
  rede: 'bg-cyan-100 text-cyan-700', marketing: 'bg-pink-100 text-pink-700',
  juridico: 'bg-red-100 text-red-700', logistica: 'bg-orange-100 text-orange-700',
}

const ACTION_STATUSES = [
  { value: 'em_analise',         label: 'Em análise' },
  { value: 'em_andamento',       label: 'Em andamento' },
  { value: 'encaminhado',        label: 'Encaminhado para depto' },
  { value: 'aguardando_retorno', label: 'Aguardando retorno' },
  { value: 'finalizado',         label: '✓ Concluído' },
]

const TL_COLORS: Record<string, string> = {
  aberto: 'bg-blue-500', em_analise: 'bg-amber-400', encaminhado: 'bg-purple-500',
  em_andamento: 'bg-green-500', aguardando_retorno: 'bg-gray-400',
  finalizado: 'bg-green-600', cancelado: 'bg-red-500', rascunho: 'bg-amber-300',
}

const STATUS_TRANS: Record<string, string> = {
  rascunho: 'Rascunho', aberto: 'Aberto', em_analise: 'Em analise',
  encaminhado: 'Encaminhado', em_andamento: 'Em andamento',
  aguardando_retorno: 'Aguardando retorno', finalizado: 'Finalizado', cancelado: 'Cancelado',
}

const PRIORITY_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Media', alta: 'Alta' }

// ─── Modal de Cadastro de Empresa ───────────────────────────────────────────
function CadastrarEmpresaModal({
  nomeInicial,
  parceiros,
  onClose,
  onSaved,
}: {
  nomeInicial: string
  parceiros: { id: string; name: string }[]
  onClose: () => void
  onSaved: (empresaId: string) => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    nome_fantasia: nomeInicial,
    razao_social: '',
    cnpj: '',
    parceiro: '',
    id_grupo: '',
    municipio: '',
    uf: '',
    endereco: '',
    bairro: '',
    cep: '',
    telefone: '',
    email: '',
    situacao_cnpj: '',
    cnae_principal: '',
  })
  const [produtos, setProdutos] = useState<string[]>([])
  const [loadingCnpj, setLoadingCnpj] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cnpjMsg, setCnpjMsg] = useState('')

  function setF(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
  }

  async function buscarCnpj() {
    if (!form.cnpj) return
    setLoadingCnpj(true)
    setCnpjMsg('')
    try {
      const cnpjLimpo = form.cnpj.replace(/\D/g, '')
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      if (!res.ok) { setCnpjMsg('CNPJ não encontrado.'); setLoadingCnpj(false); return }
      const data = await res.json()
      setForm(p => ({
        ...p,
        razao_social:   data.razao_social ?? p.razao_social,
        situacao_cnpj:  data.descricao_situacao_cadastral ?? p.situacao_cnpj,
        cnae_principal: data.cnae_fiscal ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}` : p.cnae_principal,
        endereco:       data.logradouro ? `${data.logradouro}${data.numero ? ', ' + data.numero : ''}${data.complemento ? ' - ' + data.complemento : ''}` : p.endereco,
        bairro:         data.bairro ?? p.bairro,
        cep:            data.cep ? data.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : p.cep,
        municipio:      data.municipio ?? p.municipio,
        uf:             data.uf ?? p.uf,
        telefone:       data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : p.telefone,
        nome_fantasia:  (data.nome_fantasia && data.nome_fantasia.trim()) ? data.nome_fantasia : p.nome_fantasia,
      }))
      setCnpjMsg('✓ Dados preenchidos automaticamente!')
    } catch {
      setCnpjMsg('Erro ao consultar CNPJ.')
    }
    setLoadingCnpj(false)
  }

  async function handleSave() {
    if (!form.nome_fantasia.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('empresas_conveniadas').insert({
      nome_fantasia:   form.nome_fantasia,
      razao_social:    form.razao_social || null,
      cnpj:            form.cnpj.replace(/\D/g, '') || null,
      parceiro:        form.parceiro || null,
      id_grupo:        form.id_grupo || null,
      municipio:       form.municipio || null,
      uf:              form.uf || null,
      endereco:        form.endereco || null,
      bairro:          form.bairro || null,
      cep:             form.cep || null,
      telefone:        form.telefone || null,
      email:           form.email || null,
      situacao_cnpj:   form.situacao_cnpj || null,
      cnae_principal:  form.cnae_principal || null,
      ativo:           true,
      data_cadastro:   new Date().toISOString().split('T')[0],
    }).select('id').single()

    if (error || !data) { alert('Erro ao salvar: ' + error?.message); setSaving(false); return }

    // Insere produtos
    if (produtos.length > 0) {
      await supabase.from('empresas_produtos').insert(
        produtos.map(p => ({ empresa_id: data.id, produto_nome: p }))
      )
    }

    setSaving(false)
    onSaved(data.id)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cadastrar empresa</h2>
            <p className="text-xs text-gray-400 mt-0.5">Após salvar, o atendimento será vinculado automaticamente</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* CNPJ com busca */}
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-indigo-700 uppercase">Consultar CNPJ — preenche os campos automaticamente</div>
            <div className="flex gap-2">
              <input className="input flex-1 font-mono" placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={e => setF('cnpj', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarCnpj() } }}
              />
              <button onClick={buscarCnpj} disabled={loadingCnpj || !form.cnpj}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <RefreshCw size={13} className={loadingCnpj ? 'animate-spin' : ''} />
                {loadingCnpj ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {cnpjMsg && <p className={`text-xs font-medium ${cnpjMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{cnpjMsg}</p>}
          </div>

          {/* Dados principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Nome Fantasia *</label>
              <input className="input" value={form.nome_fantasia} onChange={e => setF('nome_fantasia', e.target.value)} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Razão Social</label>
              <input className="input" value={form.razao_social} onChange={e => setF('razao_social', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Parceiro</label>
              <select className="select" value={form.parceiro} onChange={e => setF('parceiro', e.target.value)}>
                <option value="">Selecione...</option>
                {parceiros.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ID Grupo Econômico</label>
              <input className="input" placeholder="Ex: 7873" value={form.id_grupo} onChange={e => setF('id_grupo', e.target.value)} />
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Endereço</label>
              <input className="input" value={form.endereco} onChange={e => setF('endereco', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Bairro</label>
              <input className="input" value={form.bairro} onChange={e => setF('bairro', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CEP</label>
              <input className="input font-mono" value={form.cep} onChange={e => setF('cep', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Município</label>
              <input className="input" value={form.municipio} onChange={e => setF('municipio', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UF</label>
              <input className="input uppercase" maxLength={2} value={form.uf} onChange={e => setF('uf', e.target.value.toUpperCase())} />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="input" value={form.telefone} onChange={e => setF('telefone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="input" value={form.email} onChange={e => setF('email', e.target.value)} />
            </div>
          </div>

          {/* Produtos */}
          <div className="form-group">
            <label className="form-label">Produtos Contratados</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRODUTOS_OPTIONS.map(p => (
                <button key={p} type="button"
                  onClick={() => setProdutos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${produtos.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nome_fantasia.trim()}
            className="btn-primary min-w-[160px] justify-center disabled:opacity-50">
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Salvando...
              </span>
            ) : 'Cadastrar e vincular'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [history, setHistory] = useState<TicketHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [parceiros, setParceiros] = useState<{id:string;name:string}[]>([])

  // Modal de cadastro de empresa
  const [showCadastroModal, setShowCadastroModal] = useState(false)

  // Campo de registro de ação
  const [obsText, setObsText] = useState('')
  const [actionDept, setActionDept] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [obsImages, setObsImages] = useState<string[]>([])

  // Edição inline das informações
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    company_name: '', requester_name: '', employee_name: '',
    attendant_id: '', department: '', priority: '', type_name: '',
  })
  const [attendants, setAttendants] = useState<{id:string;full_name:string}[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [filtered, setFiltered] = useState<any[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { fetchData() }, [id])

  useEffect(() => {
    Promise.all([
      supabase.from('attendants').select('id, full_name').eq('active', true).order('full_name'),
      supabase.from('companies').select('id, legal_name, trade_name, cnpj').eq('status', 'ativa').order('legal_name'),
      supabase.from('empresas_conveniadas').select('id, nome_fantasia, razao_social, cnpj').eq('ativo', true).order('nome_fantasia'),
      supabase.from('partners').select('id, name').order('name'),
    ]).then(([{ data: att }, { data: comp }, { data: conv }, { data: parts }]) => {
      setAttendants((att as any[]) ?? [])
      const fromComp = (comp ?? []).map((c: any) => ({ id: c.id, legal_name: c.legal_name, trade_name: c.trade_name, cnpj: c.cnpj }))
      const fromConv = (conv ?? []).map((c: any) => ({ id: c.id, legal_name: c.nome_fantasia, trade_name: c.razao_social || c.nome_fantasia, cnpj: c.cnpj }))
      setCompanies([...fromComp, ...fromConv])
      setParceiros((parts as any[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (!companySearch || companySearch.length < 2) { setFiltered([]); return }
    const q = companySearch.toLowerCase()
    const digits = companySearch.replace(/\D/g, '')
    setFiltered(companies.filter((c: any) =>
      (c.legal_name ?? '').toLowerCase().includes(q) ||
      (c.trade_name ?? '').toLowerCase().includes(q) ||
      (digits.length >= 3 && (c.cnpj ?? '').includes(digits))
    ).slice(0, 6))
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
      setActionDept((t as any).department ?? 'comercial')
      setEditForm({
        company_name: (t as any).company_name_free ?? (t as any).company_legal_name ?? '',
        requester_name: (t as any).requester_name ?? '',
        employee_name: (t as any).employee_name ?? '',
        attendant_id: (t as any).attendant_id ?? '',
        department: (t as any).department ?? 'comercial',
        priority: (t as any).priority ?? 'media',
        type_name: (t as any).type_name ?? (t as any).type ?? '',
      })
    }
  }

  // ✅ Chamado quando empresa é cadastrada no modal — vincula ao ticket
  async function handleEmpresaCadastrada(empresaId: string) {
    await supabase.from('tickets').update({
      company_id: empresaId,
      company_name_free: null,
    }).eq('id', id)

    await supabase.from('ticket_history').insert({
      ticket_id: id,
      action: 'Empresa cadastrada e vinculada ao atendimento',
      user_id: '00000000-0000-0000-0000-000000000001',
    })

    setShowCadastroModal(false)
    fetchData()
  }

  async function handleRegistrar() {
    if (!obsText.trim()) return
    if (!actionStatus) { alert('Selecione o status atual do atendimento'); return }
    setSaving(true)

    const isFinalizado = actionStatus === 'finalizado'
    const deptLabel = DEPARTMENTS.find(d => d.value === actionDept)?.label ?? actionDept
    const statusLabel = STATUS_TRANS[actionStatus] ?? actionStatus

    const obsComImagens = obsText.trim() + (obsImages.length > 0
      ? '\n\n' + obsImages.map((url: string) => `![imagem](${url})`).join('\n')
      : '')

    const actionText = `[${deptLabel} → ${statusLabel}] ${obsComImagens}`

    const updates: Record<string, any> = { status: actionStatus, department: actionDept }
    if (isFinalizado) updates.closed_at = new Date().toISOString()

    await supabase.from('tickets').update(updates).eq('id', id)

    const lastHistory = history[history.length - 1]
    const lastTime = lastHistory ? new Date(lastHistory.created_at) : (ticket ? new Date((ticket as any).created_at) : new Date())
    const elapsedSeconds = Math.floor((Date.now() - lastTime.getTime()) / 1000)

    await supabase.from('ticket_history').insert({
      ticket_id: id,
      action: actionText,
      observation: obsComImagens,
      from_status: ticket?.status,
      to_status: actionStatus,
      user_id: '00000000-0000-0000-0000-000000000001',
      elapsed_seconds: elapsedSeconds,
    })

    setObsText('')
    setActionStatus('')
    setSaving(false)
    fetchData()
  }

  async function handleSaveEdit() {
    setSavingEdit(true)
    const updates: Record<string, any> = {
      requester_name: editForm.requester_name,
      employee_name: editForm.employee_name || null,
      attendant_id: editForm.attendant_id || null,
      department: editForm.department,
      priority: editForm.priority,
      type_name: editForm.type_name || null,
    }
    if (selectedCompany) {
      updates.company_id = selectedCompany.id
      updates.company_name_free = null
    } else if (companySearch.trim()) {
      updates.company_name_free = companySearch.trim()
      updates.company_id = null
    }

    await supabase.from('tickets').update(updates).eq('id', id)
    await supabase.from('ticket_history').insert({
      ticket_id: id,
      action: 'Informacoes do atendimento editadas',
      user_id: '00000000-0000-0000-0000-000000000001',
    })

    setSavingEdit(false)
    setEditing(false)
    setSelectedCompany(null)
    setCompanySearch('')
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

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!ticket) return <div className="p-6 text-sm text-red-500">Atendimento nao encontrado.</div>

  const isClosed = ['finalizado', 'cancelado'].includes(ticket.status)
  const isDraft = ticket.status === 'rascunho'
  const semCadastro = !(ticket as any).company_id && !!(ticket as any).company_name_free
  const currentDeptLabel = DEPARTMENTS.find(d => d.value === ticket.department)?.label ?? ticket.department
  const slaTotal = (ticket as any).sla_deadline ? (new Date((ticket as any).sla_deadline).getTime() - new Date(ticket.created_at).getTime()) / 1000 : 0
  const sla = slaTotal > 0 ? Math.min(100, Math.round(((ticket as any).open_seconds / slaTotal) * 100)) : 0

  const companyDisplay = (ticket as any).company_name_free ?? (ticket as any).company_legal_name ?? 'Não informada'
  const typeName = (ticket as any).type_name ?? (ticket as any).type ?? '—'

  return (
    <div className="p-6">
      {/* Modal de cadastro de empresa */}
      {showCadastroModal && (
        <CadastrarEmpresaModal
          nomeInicial={(ticket as any).company_name_free ?? ''}
          parceiros={parceiros}
          onClose={() => setShowCadastroModal(false)}
          onSaved={handleEmpresaCadastrada}
        />
      )}

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
        {(ticket as any).sla_breached && (
          <span className="badge bg-red-50 text-red-600 border border-red-200">
            <AlertTriangle size={11} /> SLA vencido
          </span>
        )}
        {!isClosed && (
          <button onClick={cancelTicket} className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors">
            <XCircle size={13} /> Cancelar atendimento
          </button>
        )}
      </div>

      {/* ✅ Banner empresa sem cadastro */}
      {semCadastro && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Building2 size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Empresa sem cadastro formal</p>
            <p className="text-xs text-amber-600 truncate">
              "<span className="font-medium">{(ticket as any).company_name_free}</span>" foi digitada livremente no pré-atendimento.
            </p>
          </div>
          <button
            onClick={() => setShowCadastroModal(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
          >
            <Plus size={12} /> Cadastrar empresa
          </button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4">

          {/* INFORMAÇÕES DO ATENDIMENTO */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Informacoes</span>
              {!isClosed && !editing && (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs text-[#185FA5] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors">
                  <Edit2 size={12} /> Editar
                </button>
              )}
              {editing && (
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setSelectedCompany(null); setCompanySearch('') }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg">
                    <X size={12} /> Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={savingEdit}
                    className="flex items-center gap-1 text-xs bg-[#185FA5] text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    <Check size={12} /> {savingEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="card-body">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Empresa</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{companyDisplay}</span>
                      {semCadastro && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          <Building2 size={9} /> Sem cadastro
                        </span>
                      )}
                    </div>
                  </div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Solicitante</div><div className="text-sm font-medium text-gray-900">{ticket.requester_name}</div></div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Colaborador</div><div className="text-sm font-medium text-gray-900">{ticket.employee_name ?? '—'}</div></div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Tipo</div><div className="text-sm font-medium text-gray-900">{typeName}</div></div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Departamento</div><div className="text-sm font-medium text-gray-900">{currentDeptLabel}</div></div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Atendente</div><div className="text-sm font-medium text-gray-900">{(ticket as any).attendant_name ?? '—'}</div></div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Parceiro</div><div className="text-sm font-medium text-gray-900">{ticket.partner_name ?? (ticket as any).parceiro ?? '—'}</div></div>
                  <div><div className="text-xs text-gray-400 mb-0.5">Prioridade</div><div className="text-sm font-medium text-gray-900">{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</div></div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-2">Descricao inicial</div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</div>
                  {/* ✅ Exibe imagens da descrição se houver */}
                  {(ticket as any).description_images?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(ticket as any).description_images.map((url: string, i: number) => (
                        <img key={i} src={url} alt={`Imagem ${i+1}`}
                          className="h-28 w-auto max-w-xs rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                          onClick={() => window.open(url, '_blank')} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card-body space-y-4">
                <div className="form-group">
                  <label className="form-label">Empresa</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9" placeholder="Digite o nome ou CNPJ..."
                      value={selectedCompany ? (selectedCompany.trade_name || selectedCompany.legal_name) : companySearch}
                      onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true); setSelectedCompany(null) }}
                      onFocus={() => setShowDropdown(true)} />
                  </div>
                  {showDropdown && !selectedCompany && companySearch && filtered.length > 0 && (
                    <div className="border border-gray-200 rounded-xl shadow-lg mt-1 bg-white max-h-40 overflow-y-auto z-10 relative">
                      {filtered.map((c: any) => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => { setSelectedCompany(c); setShowDropdown(false) }}>
                          <div className="text-sm font-medium text-gray-900">{c.trade_name || c.legal_name}</div>
                          <div className="text-xs text-gray-400 font-mono">{c.cnpj}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!selectedCompany && (
                    <input className="input mt-2" placeholder="Ou digite o nome manualmente..."
                      value={editForm.company_name}
                      onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} />
                  )}
                  {selectedCompany && <p className="text-xs text-green-600 mt-1">✓ {selectedCompany.legal_name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Solicitante</label>
                    <input className="input" value={editForm.requester_name} onChange={e => setEditForm(f => ({ ...f, requester_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Colaborador</label>
                    <input className="input" value={editForm.employee_name} onChange={e => setEditForm(f => ({ ...f, employee_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de solicitacao</label>
                    <input className="input" value={editForm.type_name} onChange={e => setEditForm(f => ({ ...f, type_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Atendente</label>
                    <select className="select" value={editForm.attendant_id} onChange={e => setEditForm(f => ({ ...f, attendant_id: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {attendants.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Departamento</label>
                    <select className="select" value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                      {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prioridade</label>
                    <select className="select" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TIMELINE */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Timeline</span>
              <span className="text-xs text-gray-400">{history.length} registros</span>
            </div>
            <div className="card-body">
              {history.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-6">Nenhum registro ainda. Use o campo abaixo para registrar a primeira acao.</div>
              ) : (
                <ol className="relative pl-6 border-l border-gray-100 space-y-5 mb-2">
                  {history.map((item) => {
                    const dot = item.to_status ? (TL_COLORS[item.to_status] ?? 'bg-gray-300') : 'bg-gray-300'
                    const userName = (item.user as any)?.full_name ?? 'Sistema'
                    const elapsed = (item as any).elapsed_seconds
                    return (
                      <li key={item.id} className="relative">
                        <span className={cn('absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white', dot)} />
                        {item.observation && item.observation !== item.action ? (
                          <>
                            <div className="text-sm font-medium text-gray-900">
                              {(item.observation ?? '').split('\n').map((line: string, i: number) => {
                                const imgMatch = line.match(/!\[imagem\]\((https?:\/\/[^\)]+)\)/)
                                if (imgMatch) {
                                  return (
                                    <img key={i} src={imgMatch[1]} alt="imagem anexada"
                                      className="h-32 w-auto max-w-xs rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 mt-1 block"
                                      onClick={() => window.open(imgMatch[1], '_blank')} />
                                  )
                                }
                                return line ? <p key={i} className="whitespace-pre-wrap">{line}</p> : <br key={i} />
                              })}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 italic">{item.action}</div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-600 italic">{item.action}</div>
                        )}
                        {elapsed && elapsed > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Clock size={10} />
                            <span>Tempo nesta etapa: {formatDuration(elapsed)}</span>
                          </div>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          <span className="font-medium">{userName}</span>
                          <span title={formatDate(item.created_at)}>{timeAgo(item.created_at)}</span>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* REGISTRO DE AÇÃO */}
          {!isClosed && (
            <div className="card border-blue-100">
              <div className="card-header border-blue-50 bg-blue-50/40">
                <span className="card-title text-blue-800">Registrar atualização</span>
              </div>
              <div className="card-body space-y-4">
                <PasteTextarea
                  value={obsText}
                  onChange={setObsText}
                  onImagesChange={setObsImages}
                  placeholder="Descreva o que foi feito, resultado da ligação, retorno do cliente... Use Ctrl+V para colar prints."
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Departamento responsável agora</label>
                    <select className="select" value={actionDept} onChange={e => setActionDept(e.target.value)}>
                      {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status atual do atendimento *</label>
                    <select className="select" value={actionStatus} onChange={e => setActionStatus(e.target.value)}>
                      <option value="">Selecione o status...</option>
                      {ACTION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                {actionStatus === 'finalizado' && (
                  <div className="px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                    <CheckCircle2 size={13} />
                    Este registro irá <strong>concluir e fechar</strong> o atendimento automaticamente.
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleRegistrar} disabled={saving || !obsText.trim() || !actionStatus}
                    className="btn-primary min-w-[140px] justify-center disabled:opacity-50">
                    <Send size={13} />
                    {saving ? 'Registrando...' : actionStatus === 'finalizado' ? 'Concluir atendimento' : 'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isClosed && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${ticket.status === 'finalizado' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
              {ticket.status === 'finalizado' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              Atendimento {ticket.status === 'finalizado' ? 'concluído' : 'cancelado'}.
            </div>
          )}
        </div>

        {/* SIDEBAR DIREITA */}
        <div className="space-y-4">

          {/* SLA */}
          <div className="card">
            <div className="card-header"><span className="card-title"><Clock size={14} /> SLA & Tempo</span></div>
            <div className="card-body space-y-3">
              {(ticket as any).sla_deadline && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Prazo</span>
                    <span className="font-medium text-gray-700">{formatDate((ticket as any).sla_deadline)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', sla >= 90 ? 'bg-red-500' : sla >= 70 ? 'bg-amber-400' : 'bg-[#185FA5]')}
                      style={{ width: sla + '%' }} />
                  </div>
                  <div className="text-xs text-gray-400 text-right">{sla}% do tempo</div>
                </>
              )}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Abertura</span>
                  <span className="font-medium text-gray-700">{formatDate(ticket.created_at)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">1ª resposta</span>
                  <span className="font-medium text-gray-700">{(ticket as any).first_response_at ? formatDate((ticket as any).first_response_at) : 'Pendente'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Tempo total</span>
                  <span className={cn('font-semibold', isClosed ? 'text-green-600' : 'text-[#185FA5]')}>
                    {formatDuration((ticket as any).open_seconds ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Fechamento</span>
                  <span className="font-medium text-gray-700">{(ticket as any).closed_at ? formatDate((ticket as any).closed_at) : '—'}</span>
                </div>
              </div>

              {history.filter(h => (h as any).elapsed_seconds > 0).length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">Tempo por etapa</div>
                  {history.filter(h => (h as any).elapsed_seconds > 0).map((h, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500 truncate flex-1 mr-2">{STATUS_TRANS[h.to_status ?? ''] ?? h.to_status ?? 'Inicio'}</span>
                      <span className="font-medium text-gray-700 flex-shrink-0">{formatDuration((h as any).elapsed_seconds)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empresa */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Building2 size={14} /> Empresa</span>
              {!isDraft && ticket.company_id && (
                <Link href={'/empresas/' + ticket.company_id} className="btn btn-sm text-xs">Ver →</Link>
              )}
              {semCadastro && (
                <button onClick={() => setShowCadastroModal(true)}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 transition-colors">
                  <Plus size={11} /> Cadastrar
                </button>
              )}
            </div>
            <div className="card-body space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Nome</span>
                <span className="font-medium text-gray-700 text-right max-w-[150px] truncate">{companyDisplay}</span>
              </div>
              {semCadastro && (
                <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                  Empresa sem cadastro formal
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Cidade</span>
                <span className="font-medium text-gray-700">
                  {(ticket as any).company_city && (ticket as any).company_state
                    ? (ticket as any).company_city + '/' + (ticket as any).company_state : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Parceiro</span>
                <span className="font-medium text-gray-700">{ticket.partner_name ?? (ticket as any).parceiro ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
