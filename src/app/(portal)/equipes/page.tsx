'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Check } from 'lucide-react'

/*
 * CRUD de EQUIPES responsáveis (Suporte ADM, Implantação — Pós-Vendas, ...).
 * Permite criar, renomear e inativar — nunca excluir.
 * Schema (`equipes`): id, value, label, active.
 */

interface Equipe { id: string; value: string; label: string; active: boolean }

// Gera o `value` a partir do label: sem acento, minúsculo e espaços viram "_".
const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

export default function EquipesPage() {
  const supabase = createClient()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchEquipes() }, [])

  async function fetchEquipes() {
    setLoading(true)
    const { data } = await supabase.from('equipes').select('*').order('label')
    setEquipes((data as Equipe[]) ?? [])
    setLoading(false)
  }

  function openNew() { setLabel(''); setEditingId(null); setError(''); setShowModal(true) }
  function openEdit(e: Equipe) { setLabel(e.label); setEditingId(e.id); setError(''); setShowModal(true) }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    const nome = label.trim()
    if (!nome) { setError('Informe o nome da equipe.'); return }
    setSaving(true)
    // Renomear mantém o value original (não quebra vínculos existentes); criar gera o value.
    const { error: err } = editingId
      ? await supabase.from('equipes').update({ label: nome }).eq('id', editingId)
      : await supabase.from('equipes').insert({ value: slugify(nome), label: nome, active: true })
    setSaving(false)
    if (!editingId && !slugify(nome)) { setError('Não foi possível gerar um código válido a partir do nome.'); return }
    if (err) { setError(err.message); return }
    setShowModal(false); fetchEquipes()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('equipes').update({ active: !active }).eq('id', id)
    fetchEquipes()
  }

  const ativas = equipes.filter(e => e.active)
  const inativas = equipes.filter(e => !e.active)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Equipes</h1>
          <p className="text-xs text-gray-400 mt-0.5">Equipes responsáveis pelos atendimentos · classificação e organização, nunca permissão</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={15} /> Nova equipe</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="card-header">
              <span className="card-title">Equipes ativas</span>
              <span className="text-xs text-gray-400">{ativas.length}</span>
            </div>
            <div className="table-header grid" style={{ gridTemplateColumns: '1fr 160px 100px 160px' }}>
              <span>Nome</span><span>Código</span><span>Status</span><span>Ações</span>
            </div>
            {ativas.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Nenhuma equipe cadastrada.</div>
            ) : ativas.map(e => (
              <div key={e.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 160px 100px 160px' }}>
                <div className="text-sm font-medium text-gray-900 self-center">{e.label}</div>
                <span className="font-mono text-xs text-gray-500 self-center">{e.value}</span>
                <span className="badge self-center bg-green-50 text-green-700 border border-green-200"><Check size={10} /> Ativa</span>
                <div className="flex items-center gap-1 self-center">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Renomear"><Pencil size={12} /></button>
                  <button onClick={() => toggleActive(e.id, e.active)} className="px-2 py-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 text-xs">Desativar</button>
                </div>
              </div>
            ))}
          </div>

          {inativas.length > 0 && (
            <div className="card opacity-60">
              <div className="card-header">
                <span className="card-title text-gray-400">Equipes inativas</span>
                <span className="text-xs text-gray-400">{inativas.length}</span>
              </div>
              {inativas.map(e => (
                <div key={e.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 160px 100px' }}>
                  <div className="text-sm text-gray-400 line-through self-center">{e.label}</div>
                  <span className="badge self-center bg-gray-100 text-gray-500 border border-gray-200">Inativa</span>
                  <button onClick={() => toggleActive(e.id, e.active)} className="text-xs text-[#185FA5] hover:underline self-center">Reativar</button>
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
              <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Renomear equipe' : 'Nova equipe'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Nome da equipe *</label>
                <input className="input" placeholder="Ex: Suporte ADM" value={label} onChange={e => setLabel(e.target.value)} required autoFocus />
              </div>
              {!editingId && (
                <div className="form-group">
                  <label className="form-label">Código (value) — gerado automaticamente</label>
                  <input className="input font-mono bg-gray-50 text-gray-500" value={slugify(label) || '—'} readOnly />
                  <p className="text-xs text-gray-400 mt-1">Gerado a partir do nome. Ao renomear, o código é preservado.</p>
                </div>
              )}
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar equipe'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
