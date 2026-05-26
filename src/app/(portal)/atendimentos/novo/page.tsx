'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEPARTMENT_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import type { Company } from '@/lib/types'
import { ArrowLeft, Info, Search, Plus, X, FileText, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PasteTextarea from '@/components/ui/PasteTextarea'

const ALL_DEPARTMENTS = [
  { value: 'comercial',   label: 'ADM Comercial' },
  { value: 'cadastro',    label: 'Cadastro' },
  { value: 'financeiro',  label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'rede',        label: 'Rede' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'juridico',    label: 'Jurídico' },
  { value: 'logistica',   label: 'Logística' },
]

const DEFAULT_TYPES = [
  'Segunda via cartão', 'Inclusão colaborador', 'Exclusão colaborador',
  'Alteração cadastro', 'Problema saldo', 'Problema cartão',
  'Solicitação de senha', 'Outros',
]

export default function NovoAtendimentoPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<'pre' | 'full'>('full')
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [attendants, setAttendants] = useState<{id:string;full_name:string}[]>([])
  const [filtered, setFiltered] = useState<Company[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [types, setTypes] = useState<string[]>(DEFAULT_TYPES)
  const [showNewType, setShowNewType] = useState(false)
  const [newType, setNewType] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    requester_name: '', employee_name: '', attendant_id: '',
    type_label: 'Segunda via cartao', department: 'comercial',
    priority: 'media', description: '',
  })

  useEffect(() => {
    supabase.from('companies').select('id, legal_name, trade_name, cnpj')
      .eq('status', 'ativa').order('legal_name')
      .then(({ data }) => { setCompanies((data as Company[]) ?? []); setFiltered((data as Company[]) ?? []) })
    supabase.from('attendants').select('id, full_name').eq('active', true).order('full_name')
      .then(({ data }) => setAttendants((data as any[]) ?? []))
    const saved = localStorage.getItem('vegas_ticket_types')
    if (saved) setTypes(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (!companySearch) { setFiltered(companies); return }
    const q = companySearch.toLowerCase()
    setFiltered(companies.filter(c =>
      c.legal_name.toLowerCase().includes(q) ||
      (c.trade_name ?? '').toLowerCase().includes(q) ||
      c.cnpj.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    ))
  }, [companySearch, companies])

  function set(field: string, value: string) { setForm(p => ({ ...p, [field]: value })) }

  function addNewType() {
    if (!newType.trim()) return
    const updated = [...types.filter(t => t !== 'Outros'), newType.trim(), 'Outros']
    setTypes(updated); localStorage.setItem('vegas_ticket_types', JSON.stringify(updated))
    setForm(f => ({ ...f, type_label: newType.trim() }))
    setNewType(''); setShowNewType(false)
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const newFiles = Array.from(fileList).filter(f => f.size <= 10 * 1024 * 1024)
    setFiles(prev => [...prev, ...newFiles])
  }

  async function uploadFiles(ticketId: string) {
    for (const file of files) {
      const path = `${ticketId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
      const { error } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type })
      if (!error) {
        await supabase.from('ticket_attachments').insert({
          ticket_id: ticketId, file_name: file.name, file_type: file.type,
          file_size: file.size, storage_path: path,
          uploaded_by: '00000000-0000-0000-0000-000000000001',
        })
      }
    }
  }

  async function handleSubmit(e: React.FormEvent, isDraft = false) {
    e.preventDefault()
    setError('')

    if (mode === 'full' && !selectedCompany) { setError('Selecione uma empresa.'); return }
    if (!form.description.trim()) { setError('Descrição é obrigatória.'); return }

    setLoading(true)

    const TYPE_MAP: Record<string, string> = {
      'Segunda via cartão': 'segunda_via_cartao', 'Inclusão colaborador': 'inclusao_colaborador',
      'Exclusão colaborador': 'exclusao_colaborador', 'Alteração cadastro': 'alteracao_cadastro',
      'Problema saldo': 'problema_saldo', 'Problema cartão': 'problema_cartao',
    }
    const typeDb = TYPE_MAP[form.type_label] ?? 'outros'
    const status = isDraft ? 'rascunho' : 'aberto'

    const payload: Record<string, unknown> = {
      company_id:     selectedCompany?.id ?? null,
      requester_name: form.requester_name || 'Não informado',
      employee_name:  form.employee_name || null,
      attendant_id:   form.attendant_id || null,
      type:           typeDb,
      description:    `[${form.type_label}] ${form.description}`,
      department:     form.department,
      priority:       form.priority,
      status,
      protocol:       '',
      created_by:     '00000000-0000-0000-0000-000000000001',
    }

    const { data, error: err } = await supabase.from('tickets').insert(payload).select('id, protocol').single()
    if (err) { setError(err.message); setLoading(false); return }

    if (files.length > 0) await uploadFiles(data.id)

    setLoading(false)
    router.push(`/atendimentos/${data.id}`)
  }

  const isPre = mode === 'pre'

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/atendimentos" className="btn btn-sm"><ArrowLeft size={14} /></Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">
              {isPre ? 'Pré-atendimento' : 'Novo atendimento'}
            </h1>
            <p className="text-xs text-gray-400">
              {isPre ? 'Registre rapidamente sem todos os dados' : 'Protocolo gerado automaticamente'}
            </p>
          </div>
          {/* Toggle mode */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setMode('full')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'full' ? 'bg-[#185FA5] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <FileText size={12} /> Completo
            </button>
            <button onClick={() => setMode('pre')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'pre' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Zap size={12} /> Rápido
            </button>
          </div>
        </div>

        {isPre && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
            <Zap size={14} className="flex-shrink-0 mt-0.5" />
            <span>Modo rápido — registre o que sabe agora e complete os dados depois. A empresa pode ficar em branco.</span>
          </div>
        )}

        <form onSubmit={e => handleSubmit(e, false)} className="space-y-5">
          {/* Identificação */}
          <div className="card">
            <div className="card-header"><span className="card-title">Identificação</span></div>
            <div className="card-body space-y-4">
              {/* Empresa */}
              <div className="form-group">
                <label className="form-label">Empresa {!isPre && '*'}{isPre && <span className="text-gray-400 font-normal"> (opcional)</span>}</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9" placeholder="Digite o nome ou CNPJ…"
                    value={companySearch}
                    onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true); setSelectedCompany(null) }}
                    onFocus={() => setShowDropdown(true)} />
                  {selectedCompany && (
                    <button type="button" onClick={() => { setSelectedCompany(null); setCompanySearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
                  )}
                </div>
                {showDropdown && !selectedCompany && companySearch && (
                  <div className="border border-gray-200 rounded-xl shadow-lg mt-1 bg-white max-h-48 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Nenhuma empresa encontrada</div>
                    ) : filtered.map(c => (
                      <button key={c.id} type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                        onClick={() => { setSelectedCompany(c); setCompanySearch(c.trade_name || c.legal_name); setShowDropdown(false) }}>
                        <div className="text-sm font-medium text-gray-900">{c.trade_name || c.legal_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{c.cnpj}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCompany && <p className="text-xs text-green-600 mt-1">✓ {selectedCompany.legal_name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Solicitante (RH){isPre && <span className="text-gray-400 font-normal"> (opcional)</span>}</label>
                  <input className="input" placeholder="Nome do responsável" value={form.requester_name} onChange={e => set('requester_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Colaborador envolvido</label>
                  <input className="input" placeholder="Nome do funcionário" value={form.employee_name} onChange={e => set('employee_name', e.target.value)} />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Atendente responsável</label>
                  <select className="select" value={form.attendant_id} onChange={e => set('attendant_id', e.target.value)}>
                    <option value="">Selecione o atendente...</option>
                    {attendants.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Classificação */}
          <div className="card">
            <div className="card-header"><span className="card-title">Classificação</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="form-group">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label">Tipo *</label>
                    <button type="button" onClick={() => setShowNewType(!showNewType)} className="text-[10px] text-[#185FA5] hover:underline flex items-center gap-0.5">
                      <Plus size={10} /> Novo
                    </button>
                  </div>
                  <select className="select" value={form.type_label} onChange={e => set('type_label', e.target.value)}>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {showNewType && (
                    <div className="flex gap-1 mt-2">
                      <input className="input text-xs py-1" placeholder="Novo tipo…" value={newType}
                        onChange={e => setNewType(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewType())} />
                      <button type="button" onClick={addNewType} className="btn-primary btn-sm px-2">+</button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Departamento *</label>
                  <select className="select" value={form.department} onChange={e => set('department', e.target.value)}>
                    {ALL_DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Prioridade *</label>
                  <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição *</label>
                <PasteTextarea
                  value={form.description}
                  onChange={v => set('description', v)}
                  placeholder="Cole aqui a mensagem do WhatsApp, ou use Ctrl+V para colar prints diretamente..."
                  rows={4}
                  required
                />
              </div>
            </div>
          </div>

          {/* Anexos */}
          <div className="card">
            <div className="card-header"><span className="card-title">📎 Anexos</span>
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
                <div className="text-sm text-gray-400">📎 Arraste prints do WhatsApp, PDFs ou documentos aqui</div>
                <div className="text-xs text-gray-300 mt-1">ou clique para selecionar — até 10MB por arquivo</div>
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      {f.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-10 h-10 object-cover rounded border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center text-gray-400">📄</div>
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
            <span>Protocolo gerado automaticamente. SLA: Alta = 4h · Média = 8h · Baixa = 24h.</span>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Link href="/atendimentos" className="btn">Cancelar</Link>
            {isPre && (
              <button type="button" onClick={e => handleSubmit(e as any, true)} disabled={loading}
                className="btn bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                <Zap size={14} /> {loading ? 'Salvando…' : 'Salvar rascunho'}
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary min-w-[160px] justify-center">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Abrindo…
                </span>
              ) : isPre ? '⚡ Abrir pré-atendimento' : 'Abrir atendimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
