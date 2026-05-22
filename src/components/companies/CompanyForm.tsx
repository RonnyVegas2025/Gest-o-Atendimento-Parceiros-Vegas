'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Company, Partner, CompanyStatus } from '@/lib/types'

interface Props {
  partners: Partner[]
  company?: Company           // se passado, modo edição
  onSuccess?: (id: string) => void
  onCancel?: () => void
}

const INITIAL: Omit<Company, 'id' | 'created_at' | 'updated_at'> = {
  legal_name:    '',
  trade_name:    '',
  cnpj:          '',
  city:          '',
  state:         '',
  contact_name:  '',
  contact_phone: '',
  contact_email: '',
  partner_id:    null,
  status:        'ativa',
  notes:         null,
}

export function CompanyForm({ partners, company, onSuccess, onCancel }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState(company ? {
    legal_name:    company.legal_name,
    trade_name:    company.trade_name ?? '',
    cnpj:          company.cnpj,
    city:          company.city,
    state:         company.state,
    contact_name:  company.contact_name,
    contact_phone: company.contact_phone ?? '',
    contact_email: company.contact_email ?? '',
    partner_id:    company.partner_id ?? '',
    status:        company.status,
    notes:         company.notes ?? '',
  } : { ...INITIAL, partner_id: '', notes: '' })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      ...form,
      partner_id: form.partner_id || null,
      trade_name: form.trade_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null,
    }

    const { data, error: err } = company
      ? await supabase.from('companies').update(payload).eq('id', company.id).select('id').single()
      : await supabase.from('companies').insert(payload).select('id').single()

    setLoading(false)
    if (err) { setError(err.message); return }
    onSuccess?.(data.id)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Dados da empresa */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Dados da empresa</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Razão social *</label>
              <input className="input" value={form.legal_name} onChange={e => set('legal_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nome fantasia</label>
              <input className="input" value={form.trade_name ?? ''} onChange={e => set('trade_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CNPJ *</label>
              <input className="input font-mono" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Cidade *</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Estado *</label>
              <select className="select" value={form.state} onChange={e => set('state', e.target.value)} required>
                <option value="">Selecione…</option>
                {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Contato */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Contato RH</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Nome do contato *</label>
              <input className="input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="input" placeholder="(11) 99999-0000" value={form.contact_phone ?? ''} onChange={e => set('contact_phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="input" type="email" value={form.contact_email ?? ''} onChange={e => set('contact_email', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Configurações */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Configurações</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Parceiro responsável</label>
              <select className="select" value={form.partner_id ?? ''} onChange={e => set('partner_id', e.target.value)}>
                <option value="">Sem parceiro</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value as CompanyStatus)}>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="bloqueada">Bloqueada</option>
              </select>
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Observações internas</label>
              <textarea className="textarea" rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn">Cancelar</button>
        )}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Salvando…' : company ? 'Salvar alterações' : 'Cadastrar empresa'}
        </button>
      </div>
    </form>
  )
}
