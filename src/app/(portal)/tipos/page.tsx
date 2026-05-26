'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TicketType {
  id: string
  name: string
  description: string | null
  priority: 'baixa' | 'media' | 'alta'
  sla_hours: number
  active: boolean
}

const PRIORITY_CONFIG = {
  alta:  { label: 'Alta',  color: 'bg-red-50 text-red-700 border border-red-200',    dot: 'bg-red-500' },
  media: { label: 'Media', color: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
  baixa: { label: 'Baixa', color: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
}

const SLA_OPTIONS = [
  { value: 1, label: '1 hora' }, { value: 2, label: '2 horas' },
  { value: 4, label: '4 horas' }, { value: 6, label: '6 horas' },
  { value: 8, label: '8 horas' }, { value: 12, label: '12 horas' },
  { value: 24, label: '24 horas (1 dia)' }, { value: 48, label: '48 horas (2 dias)' },
  { value: 72, label: '72 horas (3 dias)' },
]

const EMPTY = { name: '', description: '', priority: 'media' as const, sla_hours: 8 }

export default function TiposPage() {
  const supabase = createClient()
  const [types, setTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { fetchTypes() }, [])

  async function fetchTypes() {
    setLoading(true)
    const { data } = await supabase.from('ticket_types').select('*').order('name')
    setTypes((data as TicketType[]) ?? [])
    setLoading(false)
  }

  function openNew() { setForm(EMPTY); setEditingId(null); setError(''); setShowModal(true) }

  function openEdit(t: TicketType) {
    setForm({ name: t.name, description: t.description ?? '', priority: t.priority, sla_hours: t.sla_hours })
    setEditingId(t.id); setError(''); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome e obrigatorio'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), description: form.description || null, priority: form.priority, sla_hours: form.sla_hours, updated_at: new Date().toISOString() }
    const { error: err } = editingId
      ? await supabase.from('ticket_types').update(payload).eq('id', editingId)
      : await supabase.from('ticket_types').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false); fetchTypes()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('ticket_types').update({ active: !active }).eq('id', id)
    fetchTypes()
  }

  async function deleteType(id: string, name: string) {
    if (!confirm('Excluir o tipo "' + name + '"?')) return
    await supabase.from('ticket_types').delete().eq('id', id)
    fetchTypes()
  }

  const activeTypes   = types.filter(t => t.active)
  const inactiveTypes = types.filter(t => !t.active)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tipos de Solicitacao</h1>
          <p className="text-xs text-gray-400 mt-0.5">Configure tipos, prioridade padrao e SLA de cada categoria</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={15} /> Novo tipo</button>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
        <Clock size={14} className="flex-shrink-0 mt-0.5" />
        <span>O SLA e a prioridade sao preenchidos automaticamente ao abrir um atendimento com base no tipo selecionado.</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tipos ativos</span>
              <span className="text-xs text-gray-400">{activeTypes.length} tipos</span>
            </div>
            <div className="table-header grid" style={{ gridTemplateColumns: '1fr 180px 100px 100px 130px' }}>
              <span>Nome / Descricao</span><span>SLA</span><span>Prioridade</span><span>Status</span><span>Acoes</span>
            </div>
            {activeTypes.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Nenhum tipo ativo — clique em "Novo tipo"</div>
            ) : activeTypes.map(type => (
              <div key={type.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 180px 100px 100px 130px' }}>
                <div>
                  <div className="text-sm font-medium text-gray-900">{type.name}</div>
                  {type.description && <div className="text-xs text-gray-400 mt-0.5">{type.description}</div>}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-700">
                  <Clock size={12} className="text-gray-400" />
                  {SLA_OPTIONS.find(s => s.value === type.sla_hours)?.label ?? type.sla_hours + 'h'}
                </div>
                <span className={cn('badge', PRIORITY_CONFIG[type.priority].color)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[type.priority].dot)} />
                  {PRIORITY_CONFIG[type.priority].label}
                </span>
                <span className="badge bg-green-50 text-green-700 border border-green-200"><Check size={10} /> Ativo</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(type)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" title="Editar"><Pencil size={13} /></button>
                  <button onClick={() => toggleActive(type.id, type.active)} className="px-2 py-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 text-xs">Desativar</button>
                  <button onClick={() => deleteType(type.id, type.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><X size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          {inactiveTypes.length > 0 && (
            <div className="card opacity-60">
              <div className="card-header">
                <span className="card-title text-gray-400">Tipos inativos</span>
                <span className="text-xs text-gray-400">{inactiveTypes.length}</span>
              </div>
              {inactiveTypes.map(type => (
                <div key={type.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 180px 100px 100px 130px' }}>
                  <div className="text-sm text-gray-400 line-through">{type.name}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{type.sla_hours}h</div>
                  <span className={cn('badge opacity-50', PRIORITY_CONFIG[type.priority].color)}>{PRIORITY_CONFIG[type.priority].label}</span>
                  <span className="badge bg-gray-100 text-gray-500 border border-gray-200">Inativo</span>
                  <button onClick={() => toggleActive(type.id, type.active)} className="text-xs text-[#185FA5] hover:underline">Reativar</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Editar tipo' : 'Novo tipo de solicitacao'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="input" placeholder="Ex: Desbloqueio de cartao" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descricao <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input className="input" placeholder="Breve descricao..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">SLA (prazo) *</label>
                  <select className="select" value={form.sla_hours} onChange={e => setForm(f => ({ ...f, sla_hours: parseInt(e.target.value) }))}>
                    {SLA_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Prioridade padrao *</label>
                  <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              {/* Preview */}
              <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1.5">
                <div className="font-medium text-gray-600 mb-1">Preview ao abrir atendimento:</div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Prioridade:</span>
                  <span className={cn('badge', PRIORITY_CONFIG[form.priority].color)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[form.priority].dot)} />
                    {PRIORITY_CONFIG[form.priority].label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock size={11} />
                  <span>Prazo: {SLA_OPTIONS.find(s => s.value === form.sla_hours)?.label ?? form.sla_hours + 'h'} apos abertura</span>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar tipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

