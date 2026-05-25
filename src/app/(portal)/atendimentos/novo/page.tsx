'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TYPE_LABELS, DEPARTMENT_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import type { Company } from '@/lib/types'
import { ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'

export default function NovoAtendimentoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    company_id:     '',
    requester_name: '',
    employee_name:  '',
    type:           'segunda_via_cartao',
    department:     'operacional',
    priority:       'media',
    description:    '',
  })

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, legal_name, trade_name')
      .eq('status', 'ativa')
      .order('legal_name')
      .then(({ data }) => setCompanies((data as Company[]) ?? []))
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.company_id) { setError('Selecione uma empresa.'); return }
    if (!form.description.trim()) { setError('Descrição é obrigatória.'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error: err } = await supabase
      .from('tickets')
      .insert({
        ...form,
        protocol: '',
        created_by: user!.id,
      })
      .select('id')
      .single()

    setLoading(false)

    if (err) { setError(err.message); return }
    router.push(`/atendimentos/${data.id}`)
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/atendimentos" className="btn btn-sm">
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Novo atendimento</h1>
            <p className="text-xs text-gray-400">Protocolo gerado automaticamente ao salvar</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Identificação</span>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group col-span-2">
                  <label className="form-label">Empresa *</label>
                  <select
                    className="select"
                    value={form.company_id}
                    onChange={e => set('company_id', e.target.value)}
                    required
                  >
                    <option value="">Selecione a empresa…</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.trade_name || c.legal_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Solicitante (RH) *</label>
                  <input
                    className="input"
                    placeholder="Nome do responsável de RH"
                    value={form.requester_name}
                    onChange={e => set('requester_name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Colaborador envolvido</label>
                  <input
                    className="input"
                    placeholder="Nome do funcionário"
                    value={form.employee_name ?? ''}
                    onChange={e => set('employee_name', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Classificação */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Classificação</span>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Tipo *</label>
                  <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Departamento *</label>
                  <select className="select" value={form.department} onChange={e => set('department', e.target.value)}>
                    {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Prioridade *</label>
                  <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição completa *</label>
                <textarea
                  className="textarea"
                  placeholder="Descreva a solicitação com todos os detalhes necessários…"
                  rows={4}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Info SLA */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              O protocolo será gerado automaticamente. SLA calculado pela prioridade:
              Alta = 4h · Média = 8h · Baixa = 24h.
            </span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Link href="/atendimentos" className="btn">
              Cancelar
            </Link>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Abrindo atendimento…' : 'Abrir atendimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
