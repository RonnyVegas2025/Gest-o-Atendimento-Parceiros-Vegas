'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Check } from 'lucide-react'
import { useDepartments } from '@/hooks/useDepartments'

/*
 * CRUD de TIPOS DE ERRO por departamento. Permite inativar, nunca excluir.
 * Schema assumido (`tipos_erro`): id, department (value), nome, active.
 */

interface TipoErro {
  id: string
  department: string
  nome: string
  active: boolean
}

const EMPTY = { department: '', nome: '' }

export default function TiposErroPage() {
  const supabase = createClient()
  const { departments, deptLabels, loading: deptLoading } = useDepartments()

  const [tipos, setTipos] = useState<TipoErro[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { fetchTipos() }, [])

  async function fetchTipos() {
    setLoading(true)
    const { data } = await supabase.from('tipos_erro').select('*').order('department').order('nome')
    setTipos((data as TipoErro[]) ?? [])
    setLoading(false)
  }

  // Agrupa os ativos por departamento
  const grouped = useMemo(() => {
    const map: Record<string, TipoErro[]> = {}
    tipos.filter(t => t.active).forEach(t => {
      if (!map[t.department]) map[t.department] = []
      map[t.department].push(t)
    })
    return map
  }, [tipos])

  const inativos = tipos.filter(t => !t.active)

  function openNew() {
    setForm(EMPTY); setEditingId(null); setError(''); setShowModal(true)
  }
  function openEdit(t: TipoErro) {
    setForm({ department: t.department, nome: t.nome }); setEditingId(t.id); setError(''); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.department) { setError('Selecione o departamento.'); return }
    if (!form.nome.trim()) { setError('Informe o nome do tipo de erro.'); return }
    setSaving(true)
    const payload = { department: form.department, nome: form.nome.trim() }
    const { error: err } = editingId
      ? await supabase.from('tipos_erro').update(payload).eq('id', editingId)
      : await supabase.from('tipos_erro').insert({ ...payload, active: true })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false)
    fetchTipos()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('tipos_erro').update({ active: !active }).eq('id', id)
    fetchTipos()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tipos de Erro</h1>
          <p className="text-xs text-gray-400 mt-0.5">Catálogo de erros por departamento · usados no registro de ocorrências</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={15} /> Novo tipo de erro</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="space-y-3">
            {Object.keys(grouped).length === 0 && (
              <div className="card"><div className="py-10 text-center text-sm text-gray-400">Nenhum tipo de erro cadastrado.</div></div>
            )}
            {Object.entries(grouped).map(([dept, items]) => (
              <div key={dept} className="card overflow-hidden">
                <div className="card-header">
                  <span className="card-title">{deptLabels[dept] ?? dept}</span>
                  <span className="text-xs text-gray-400">{items.length} tipo{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="table-header grid" style={{ gridTemplateColumns: '1fr 100px 160px' }}>
                  <span>Nome</span><span>Status</span><span>Ações</span>
                </div>
                {items.map(t => (
                  <div key={t.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 100px 160px' }}>
                    <div className="text-sm font-medium text-gray-900 self-center">{t.nome}</div>
                    <span className="badge self-center bg-green-50 text-green-700 border border-green-200"><Check size={10} /> Ativo</span>
                    <div className="flex items-center gap-1 self-center">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => toggleActive(t.id, t.active)} className="px-2 py-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 text-xs">Desativar</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {inativos.length > 0 && (
            <div className="card opacity-60">
              <div className="card-header">
                <span className="card-title text-gray-400">Tipos inativos</span>
                <span className="text-xs text-gray-400">{inativos.length}</span>
              </div>
              {inativos.map(t => (
                <div key={t.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 160px 100px' }}>
                  <div className="self-center">
                    <div className="text-sm text-gray-400 line-through">{t.nome}</div>
                    <div className="text-xs text-gray-300">{deptLabels[t.department] ?? t.department}</div>
                  </div>
                  <span className="badge self-center bg-gray-100 text-gray-500 border border-gray-200">Inativo</span>
                  <button onClick={() => toggleActive(t.id, t.active)} className="text-xs text-[#185FA5] hover:underline self-center">Reativar</button>
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
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Editar tipo de erro' : 'Novo tipo de erro'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Departamento *</label>
                <select className="select" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} disabled={deptLoading} required>
                  <option value="">Selecione o departamento...</option>
                  {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nome do tipo de erro *</label>
                <input className="input" placeholder="Ex: Cadastro divergente, Falha no envio..." value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar tipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
