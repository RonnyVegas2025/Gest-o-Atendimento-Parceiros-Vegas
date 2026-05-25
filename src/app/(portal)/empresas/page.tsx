'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import { Plus, X, Search, Building2, Loader2 } from 'lucide-react'
import type { Company, Partner } from '@/lib/types'

interface CompanyForm {
  legal_name: string
  trade_name: string
  cnpj: string
  city: string
  state: string
  contact_name: string
  contact_phone: string
  contact_email: string
  partner_id: string
  status: string
  notes: string
}

const EMPTY_FORM: CompanyForm = {
  legal_name: '', trade_name: '', cnpj: '', city: '', state: '',
  contact_name: '', contact_phone: '', contact_email: '',
  partner_id: '', status: 'ativa', notes: '',
}

const ESTADOS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function EmpresasPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<Company[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM)

  useEffect(() => {
    fetchCompanies()
    supabase.from('partners').select('*').eq('active', true).order('name')
      .then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  async function fetchCompanies() {
    setLoading(true)
    const { data } = await supabase
      .from('companies')
      .select('*, partner:partner_id(name)')
      .order('legal_name')
    setCompanies((data as Company[]) ?? [])
    setLoading(false)
  }

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Busca CNPJ na ReceitaWS
  async function handleCNPJ(raw: string) {
    const cnpj = raw.replace(/\D/g, '')
    setField('cnpj', raw)
    setCnpjError('')

    if (cnpj.length !== 14) return

    setCnpjLoading(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      const data = await res.json()

      if (data.message || data.type === 'service_error') {
        setCnpjError('CNPJ não encontrado ou inválido.')
        setCnpjLoading(false)
        return
      }

      setForm(prev => ({
        ...prev,
        cnpj: raw,
        legal_name:    data.razao_social ?? prev.legal_name,
        trade_name:    data.nome_fantasia ?? prev.trade_name,
        city:          data.municipio ?? prev.city,
        state:         data.uf ?? prev.state,
        contact_phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1 ?? ''}`.trim() : prev.contact_phone,
        contact_email: data.email?.toLowerCase() ?? prev.contact_email,
      }))
    } catch {
      setCnpjError('Erro ao consultar CNPJ. Preencha manualmente.')
    } finally {
      setCnpjLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      ...form,
      cnpj: form.cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
      partner_id: form.partner_id || null,
      trade_name: form.trade_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null,
    }

    const { error: err } = await supabase.from('companies').insert(payload)
    setSaving(false)

    if (err) { setError(err.message); return }

    setShowModal(false)
    setForm(EMPTY_FORM)
    fetchCompanies()
  }

  const filtered = companies.filter(c =>
    !search ||
    c.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.trade_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    c.city.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Empresas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{companies.length} empresas cadastradas</p>
        </div>
        <button onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setError(''); setCnpjError('') }} className="btn-primary">
          <Plus size={15} /> Nova empresa
        </button>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nome, CNPJ ou cidade…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns: '1fr 140px 160px 90px' }}>
          <span>Empresa</span><span>Cidade / UF</span><span>Parceiro</span><span>Status</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhuma empresa encontrada</div>
        ) : filtered.map(company => (
          <div key={company.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 140px 160px 90px' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-semibold flex-shrink-0">
                {(company.trade_name || company.legal_name).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{company.trade_name || company.legal_name}</div>
                <div className="text-xs text-gray-400 font-mono">{company.cnpj}</div>
              </div>
            </div>
            <span className="text-sm text-gray-600">{company.city}, {company.state}</span>
            <span className="text-sm text-gray-600 truncate">{(company as any).partner?.name ?? '—'}</span>
            <span className={cn('badge', COMPANY_STATUS_COLORS[company.status])}>{COMPANY_STATUS_LABELS[company.status]}</span>
          </div>
        ))}
      </div>

      {/* Modal Nova Empresa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-sm font-semibold text-gray-900">Nova empresa</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* CNPJ com busca automática */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Dados da empresa</div>
                <div className="form-group">
                  <label className="form-label">CNPJ *</label>
                  <div className="relative">
                    <input
                      className="input pr-10 font-mono"
                      placeholder="00.000.000/0000-00"
                      value={form.cnpj}
                      onChange={e => handleCNPJ(e.target.value)}
                      maxLength={18}
                      required
                    />
                    {cnpjLoading && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#185FA5] animate-spin" />
                    )}
                  </div>
                  {cnpjLoading && <p className="text-xs text-[#185FA5] mt-1">Consultando Receita Federal…</p>}
                  {cnpjError && <p className="text-xs text-amber-600 mt-1">{cnpjError}</p>}
                  {!cnpjLoading && !cnpjError && form.legal_name && (
                    <p className="text-xs text-green-600 mt-1">✓ Dados preenchidos automaticamente</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group col-span-2">
                    <label className="form-label">Razão social *</label>
                    <input className="input" value={form.legal_name} onChange={e => setField('legal_name', e.target.value)} required />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Nome fantasia</label>
                    <input className="input" value={form.trade_name} onChange={e => setField('trade_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cidade *</label>
                    <input className="input" value={form.city} onChange={e => setField('city', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado *</label>
                    <select className="select" value={form.state} onChange={e => setField('state', e.target.value)} required>
                      <option value="">Selecione…</option>
                      {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contato RH */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contato RH</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group col-span-2">
                    <label className="form-label">Nome do contato *</label>
                    <input className="input" value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="input" placeholder="(11) 99999-0000" value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="input" type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Configurações */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Configurações</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Parceiro responsável</label>
                    <select className="select" value={form.partner_id} onChange={e => setField('partner_id', e.target.value)}>
                      <option value="">Sem parceiro</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="select" value={form.status} onChange={e => setField('status', e.target.value)}>
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                      <option value="bloqueada">Bloqueada</option>
                    </select>
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Observações internas</label>
                    <textarea className="textarea" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} />
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Salvando…' : 'Cadastrar empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
