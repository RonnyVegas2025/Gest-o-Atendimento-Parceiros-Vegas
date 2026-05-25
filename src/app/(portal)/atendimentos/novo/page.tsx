'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEPARTMENT_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import type { Company } from '@/lib/types'
import { ArrowLeft, Info, Search, Plus, X } from 'lucide-react'
import Link from 'next/link'

const DEFAULT_TYPES = [
  'Segunda via cartão',
  'Inclusão colaborador',
  'Exclusão colaborador',
  'Alteração cadastro',
  'Problema saldo',
  'Problema cartão',
  'Solicitação de senha',
  'Outros',
]

const TYPE_MAP: Record<string, string> = {
  'Segunda via cartão':    'segunda_via_cartao',
  'Inclusão colaborador':  'inclusao_colaborador',
  'Exclusão colaborador':  'exclusao_colaborador',
  'Alteração cadastro':    'alteracao_cadastro',
  'Problema saldo':        'problema_saldo',
  'Problema cartão':       'problema_cartao',
  'Solicitação de senha':  'outros',
  'Outros':                'outros',
}

export default function NovoAtendimentoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [types, setTypes] = useState<string[]>(DEFAULT_TYPES)
  const [showNewType, setShowNewType] = useState(false)
  const [newType, setNewType] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    requester_name: '',
    employee_name:  '',
    type_label:     'Segunda via cartão',
    department:     'operacional',
    priority:       'media',
    description:    '',
  })

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, legal_name, trade_name, cnpj')
      .eq('status', 'ativa')
      .order('legal_name')
      .then(({ data }) => {
        setCompanies((data as Company[]) ?? [])
        setFilteredCompanies((data as Company[]) ?? [])
      })

    // Load custom types from localStorage
    const saved = localStorage.getItem('vegas_ticket_types')
    if (saved) setTypes(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (!companySearch) {
      setFilteredCompanies(companies)
    } else {
      const q = companySearch.toLowerCase()
      setFilteredCompanies(companies.filter(c =>
        c.legal_name.toLowerCase().includes(q) ||
        (c.trade_name ?? '').toLowerCase().includes(q) ||
        c.cnpj.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      ))
    }
  }, [companySearch, companies])

  function selectCompany(company: Company) {
    setSelectedCompany(company)
    setCompanySearch(company.trade_name || company.legal_name)
    setShowDropdown(false)
  }

  function addNewType() {
    if (!newType.trim()) return
    const updated = [...types.filter(t => t !== 'Outros'), newType.trim(), 'Outros']
    setTypes(updated)
    localStorage.setItem('vegas_ticket_types', JSON.stringify(updated))
    setForm(f => ({ ...f, type_label: newType.trim() }))
    setNewType('')
    setShowNewType(false)
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedCompany) { setError('Selecione uma empresa.'); return }
    if (!form.description.trim()) { setError('Descrição é obrigatória.'); return }

    setLoading(true)

    const typeDb = TYPE_MAP[form.type_label] ?? 'outros'

    const { data, error: err } = await supabase
      .from('tickets')
      .insert({
        company_id:     selectedCompany.id,
        requester_name: form.requester_name,
        employee_name:  form.employee_name || null,
        type:           typeDb,
        description:    `[${form.type_label}] ${form.description}`,
        department:     form.department,
        priority:       form.priority,
        protocol:       '',
        created_by:     '00000000-0000-0000-0000-000000000001',
      })
      .select('protocol')
      .single()

    setLoading(false)

    if (err) { setError(err.message); return }

    setSuccess(`Atendimento criado! Protocolo: ${data.protocol}`)
    setSelectedCompany(null)
    setCompanySearch('')
    setForm({ requester_name: '', employee_name: '', type_label: 'Segunda via cartão', department: 'operacional', priority: 'media', description: '' })
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/atendimentos" className="btn btn-sm"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Novo atendimento</h1>
            <p className="text-xs text-gray-400">Protocolo gerado automaticamente ao salvar</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            ✅ {success} — <Link href="/atendimentos" className="underline font-medium">Ver atendimentos</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="card">
            <div className="card-header"><span className="card-title">Identificação</span></div>
            <div className="card-body space-y-4">

              {/* Busca empresa */}
              <div className="form-group">
                <label className="form-label">Empresa *</label>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="input pl-9"
                      placeholder="Digite o nome ou CNPJ da empresa…"
                      value={companySearch}
                      onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true); setSelectedCompany(null) }}
                      onFocus={() => setShowDropdown(true)}
                      required={!selectedCompany}
                    />
                    {selectedCompany && (
                      <button type="button" onClick={() => { setSelectedCompany(null); setCompanySearch('') }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {showDropdown && !selectedCompany && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredCompanies.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Nenhuma empresa encontrada</div>
                      ) : filteredCompanies.map(c => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => selectCompany(c)}>
                          <div className="text-sm font-medium text-gray-900">{c.trade_name || c.legal_name}</div>
                          <div className="text-xs text-gray-400 font-mono">{c.cnpj}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedCompany && (
                  <p className="text-xs text-green-600 mt-1">✓ {selectedCompany.legal_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Solicitante (RH) *</label>
                  <input className="input" placeholder="Nome do responsável de RH" value={form.requester_name} onChange={e => set('requester_name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Colaborador envolvido</label>
                  <input className="input" placeholder="Nome do funcionário" value={form.employee_name} onChange={e => set('employee_name', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Classificação */}
          <div className="card">
            <div className="card-header"><span className="card-title">Classificação</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-3 gap-4">

                {/* Tipo com opção de adicionar novo */}
                <div className="form-group">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label">Tipo *</label>
                    <button type="button" onClick={() => setShowNewType(!showNewType)}
                      className="text-[10px] text-[#185FA5] hover:underline flex items-center gap-0.5">
                      <Plus size={10} /> Novo tipo
                    </button>
                  </div>
                  <select className="select" value={form.type_label} onChange={e => set('type_label', e.target.value)}>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {showNewType && (
                    <div className="flex gap-1 mt-2">
                      <input className="input text-xs py-1" placeholder="Nome do novo tipo…" value={newType} onChange={e => setNewType(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewType())} />
                      <button type="button" onClick={addNewType} className="btn-primary btn-sm px-2">+</button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Departamento *</label>
                  <select className="select" value={form.department} onChange={e => set('department', e.target.value)}>
                    {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Prioridade *</label>
                  <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição completa *</label>
                <textarea className="textarea" placeholder="Descreva a solicitação com todos os detalhes…" rows={4} value={form.description} onChange={e => set('description', e.target.value)} required />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>Protocolo gerado automaticamente. SLA: Alta = 4h · Média = 8h · Baixa = 24h.</span>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Link href="/atendimentos" className="btn">Cancelar</Link>
            <button type="submit" disabled={loading} className="btn-primary min-w-[160px] justify-center">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Abrindo…
                </span>
              ) : 'Abrir atendimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
