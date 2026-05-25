'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Phone, Mail } from 'lucide-react'
import type { Partner } from '@/lib/types'

const EMPTY: Omit<Partner, 'id' | 'created_at'> = {
  name: '', email: null, phone: null, active: true,
}

export default function ParceirosPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  useEffect(() => { fetchPartners() }, [])

  async function fetchPartners() {
    setLoading(true)
    const { data } = await supabase.from('partners').select('*').order('name')
    setPartners((data as Partner[]) ?? [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error: err } = await supabase.from('partners').insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false)
    setForm({ name: '', email: '', phone: '' })
    fetchPartners()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('partners').update({ active: !active }).eq('id', id)
    fetchPartners()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Parceiros</h1>
          <p className="text-xs text-gray-400 mt-0.5">{partners.length} parceiros cadastrados</p>
        </div>
        <button onClick={() => { setShowModal(true); setError('') }} className="btn-primary">
          <Plus size={15} /> Novo parceiro
        </button>
      </div>

      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns: '1fr 180px 200px 80px' }}>
          <span>Nome</span><span>Telefone</span><span>E-mail</span><span>Status</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando…</div>
        ) : partners.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhum parceiro cadastrado ainda
          </div>
        ) : partners.map(p => (
          <div key={p.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 180px 200px 80px' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-semibold flex-shrink-0">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-900">{p.name}</span>
            </div>
            <span className="text-sm text-gray-500">{p.phone ?? '—'}</span>
            <span className="text-sm text-gray-500 truncate">{p.email ?? '—'}</span>
            <button
              onClick={() => toggleActive(p.id, p.active)}
              className={`badge cursor-pointer ${p.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
            >
              {p.active ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Novo parceiro</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Nome completo *</label>
                <input className="input" placeholder="Nome do parceiro" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="input" placeholder="(11) 99999-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="input" type="email" placeholder="parceiro@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Salvando…' : 'Cadastrar parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
