'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Company } from '@/lib/types'
import { ArrowLeft, Info, Search, X, FileText, Zap, Clock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PasteTextarea from '@/components/ui/PasteTextarea'
import { cn } from '@/lib/utils'

const ALL_DEPARTMENTS = [
  { value: 'comercial',   label: 'ADM Comercial' },
  { value: 'cadastro',    label: 'Cadastro' },
  { value: 'financeiro',  label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'rede',        label: 'Rede' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'juridico',    label: 'Juridico' },
  { value: 'logistica',   label: 'Logistica' },
]

const PRIORITY_COLORS: Record<string, string> = {
  alta:  'bg-red-50 text-red-700 border border-red-200',
  media: 'bg-amber-50 text-amber-700 border border-amber-200',
  baixa: 'bg-green-50 text-green-700 border border-green-200',
}

const PRIORITY_LABELS: Record<string, string> = {
  alta: 'Alta', media: 'Media', baixa: 'Baixa'
}

interface TicketType {
  id: string
  name: string
  priority: 'baixa' | 'media' | 'alta'
  sla_hours: number
  active: boolean
}

export default function NovoAtendimentoPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<'pre' | 'full'>('full')
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [attendants, setAttendants] = useState<{id:string;full_name:string}[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [filtered, setFiltered] = useState<Company[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    requester_name: '',
    employee_name:  '',
    attendant_id:   '',
    type_id:        '',
    department:     'comercial',
    priority:       'media',
    sla_hours:      8,
    description:    '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('companies').select('id, legal_name, trade_name, cnpj').eq('status', 'ativa').order('legal_name'),
      supabase.from('empresas_conveniadas').select('id, nome_fantasia, razao_social, cnpj').eq('ativo', true).order('nome_fantasia')
    ]).then(([{ data: comp }, { data: conv }]) => {
      const fromCompanies = (comp ?? []).map((c: any) => ({ id: c.id, legal_name: c.legal_name, trade_name: c.trade_name, cnpj: c.cnpj }))
      const fromConveniadas = (conv ?? []).map((c: any) => ({ id: c.id, legal_name: c.nome_fantasia, trade_name: c.razao_social || c.nome_fantasia, cnpj: c.cnpj }))
      const all = [...fromCompanies, ...fromConveniadas]
      setCompanies(all as any)
      setFiltered(all as any)
    })
    supabase.from('attendants').select('id, full_name').eq('active', true).order('full_name')
      .then(({ data }) => setAttendants((data as any[]) ?? []))
    supabase.from('ticket_types').select('*').eq('active', true).order('name')
      .then(({ data }) => {
        const types = (data as TicketType[]) ?? []
        setTicketTypes(types)
        if (types.length > 0) {
          setForm(f => ({
            ...f,
            type_id:  types[0].id,
            priority: types[0].priority,
            sla_hours: types[0].sla_hours,
          }))
        }
      })
  }, [])

  useEffect(() => {
    if (!companySearch || companySearch.length < 2) { setFiltered([]); return }
    const q = companySearch.toLowerCase()
    const digits = companySearch.replace(/\D/g, '')
    const results = companies.filter((c: any) =>
      (c.legal_name ?? '').toLowerCase().includes(q) ||
      (c.trade_name ?? '').toLowerCase().includes(q) ||
      (digits.length >= 3 && (c.cnpj ?? '').includes(digits))
    )
    setFiltered(results)
  }, [companySearch, companies])

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function handleTypeChange(typeId: string) {
    const type = ticketTypes.find(t => t.id === typeId)
    if (type) {
      setForm(f => ({
        ...f,
        type_id:   type.id,
        priority:  type.priority,
        sla_hours: type.sla_hours,
      }))
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const newFiles = Array.from(fileList).filter(f => f.size <= 10 * 1024 * 1024)
    setFiles(prev => [...prev, ...newFiles])
  }

  async function handleSubmit(e: React.FormEvent, isDraft = false) {
    e.preventDefault()
    setError('')
    if (mode === 'full' && !selectedCompany) { setError('Selecione uma empresa.'); return }
    if (!form.description.trim()) { setError('Descricao e obrigatoria.'); return }
    setLoading(true)

    const selectedType = ticketTypes.find(t => t.id === form.type_id)
    const status = isDraft ? 'rascunho' : 'aberto'

    const payload: Record<string, unknown> = {
  company_id:     selectedCompany?.id ?? null,
  company_name_free: !selectedCompany && companySearch.trim() ? companySearch.trim() : null,
  requester_name: form.requester_name || 'Nao informado',
  employee_name:  form.employee_name || null,
  attendant_id:   form.attendant_id || null,
  type:           'outros',
  type_name:      selectedType?.name ?? null,
  description:    form.description,
  department:     form.department,
  priority:       form.priority,
  status,
  protocol:       '',
  created_by:     '00000000-0000-0000-0000-000000000001',
}

    const { data, error: err } = await supabase
      .from('tickets').insert(payload).select('id, protocol').single()

    if (err) { setError(err.message); setLoading(false); return }

    setLoading(false)
    router.push('/atendimentos/' + data.id)
  }

  const selectedType = ticketTypes.find(t => t.id === form.type_id)
  const isPre = mode === 'pre'

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/atendimentos" className="btn btn-sm"><ArrowLeft size={14} /></Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">
              {isPre ? 'Pre-atendimento' : 'Novo atendimento'}
            </h1>
            <p className="text-xs text-gray-400">
              {isPre ? 'Registre rapidamente sem todos os dados' : 'Protocolo gerado automaticamente'}
            </p>
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setMode('full')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'full' ? 'bg-[#185FA5] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <FileText size={12} /> Completo
            </button>
            <button onClick={() => setMode('pre')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'pre' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Zap size={12} /> Rapido
            </button>
          </div>
        </div>

        {isPre && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
            <Zap size={14} className="flex-shrink-0 mt-0.5" />
            <span>Modo rapido — registre o que sabe agora e complete os dados depois. A empresa pode ficar em branco.</span>
          </div>
        )}

        <form onSubmit={e => handleSubmit(e, false)} className="space-y-5">
          {/* Identificacao */}
          <div className="card">
            <div className="card-header"><span className="card-title">Identificacao</span></div>
            <div className="card-body space-y-4">
              <div className="form-group">
                <label className="form-label">Empresa {!isPre && '*'}{isPre && <span className="text-gray-400 font-normal"> (opcional)</span>}</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9" placeholder="Digite o nome ou CNPJ..."
                    value={companySearch}
                    onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true); setSelectedCompany(null) }}
                    onFocus={() => setShowDropdown(true)} />
                  {selectedCompany && (
                    <button type="button" onClick={() => { setSelectedCompany(null); setCompanySearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
                  )}
                </div>
                {showDropdown && !selectedCompany && companySearch && (
                  <div className="border border-gray-200 rounded-xl shadow-lg mt-1 bg-white max-h-48 overflow-y-auto z-10 relative">
                    {filtered.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Nenhuma empresa encontrada</div>
                    ) : filtered.slice(0, 6).map(c => (
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
                  <label className="form-label">Solicitante (RH){isPre && <span className="text-gray-400 font-normal"> (opcional)</span>}</label>
                  <input className="input" placeholder="Nome do responsavel" value={form.requester_name} onChange={e => set('requester_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Colaborador envolvido</label>
                  <input className="input" placeholder="Nome do funcionario" value={form.employee_name} onChange={e => set('employee_name', e.target.value)} />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Atendente responsavel</label>
                  <select className="select" value={form.attendant_id} onChange={e => set('attendant_id', e.target.value)}>
                    <option value="">Selecione o atendente...</option>
                    {attendants.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Classificacao */}
          <div className="card">
            <div className="card-header"><span className="card-title">Classificacao</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Tipo — carrega do banco */}
                <div className="form-group col-span-2">
                  <label className="form-label">Tipo de solicitacao *</label>
                  <select className="select" value={form.type_id} onChange={e => handleTypeChange(e.target.value)} required>
                    <option value="">Selecione o tipo...</option>
                    {ticketTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {/* Preview SLA e prioridade automaticos */}
                  {selectedType && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className={cn('badge', PRIORITY_COLORS[selectedType.priority])}>
                        <span className={cn('w-1.5 h-1.5 rounded-full mr-1', selectedType.priority === 'alta' ? 'bg-red-500' : selectedType.priority === 'media' ? 'bg-amber-400' : 'bg-green-500')} />
                        Prioridade {PRIORITY_LABELS[selectedType.priority]} (automatico)
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
                        <Clock size={11} />
                        SLA: {selectedType.sla_hours}h (automatico)
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Departamento *</label>
                  <select className="select" value={form.department} onChange={e => set('department', e.target.value)}>
                    {ALL_DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>

                {/* Prioridade — preenchida automaticamente mas editavel */}
                <div className="form-group">
                  <label className="form-label">Prioridade <span className="text-gray-400 font-normal">(ajustar se necessario)</span></label>
                  <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descricao *</label>
                <PasteTextarea
                  value={form.description}
                  onChange={v => set('description', v)}
                  placeholder="Cole aqui a mensagem do WhatsApp, ou use Ctrl+V para colar prints..."
                  rows={4}
                  required
                />
              </div>
            </div>
          </div>

          {/* Anexos */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Anexos</span>
              <span className="text-xs text-gray-400">{files.length} arquivo(s)</span>
            </div>
            <div className="card-body space-y-3">
              <div
                className={`upload-area ${dragging ? 'dragging' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}>
                <input ref={fileRef} type="file" multiple className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={e => handleFiles(e.target.files)} />
                <div className="text-sm text-gray-400">Arraste prints do WhatsApp, PDFs ou documentos aqui</div>
                <div className="text-xs text-gray-300 mt-1">ou clique para selecionar — ate 10MB por arquivo</div>
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      {f.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-10 h-10 object-cover rounded border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center text-gray-400 text-lg">📄</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{f.name}</div>
                        <div className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)}KB</div>
                      </div>
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>Protocolo gerado automaticamente. SLA e prioridade definidos pelo tipo de solicitacao.</span>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Link href="/atendimentos" className="btn">Cancelar</Link>
            {isPre && (
              <button type="button" onClick={e => handleSubmit(e as any, true)} disabled={loading}
                className="btn bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                <Zap size={14} /> {loading ? 'Salvando...' : 'Salvar rascunho'}
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary min-w-[160px] justify-center">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Abrindo...
                </span>
              ) : isPre ? 'Abrir pre-atendimento' : 'Abrir atendimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
