'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Check, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Attendant {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: 'gestor_master' | 'supervisor_adm' | 'atendimento'
  department: string | null
  active: boolean
}

const ROLE_CONFIG = {
  gestor_master:  { label: 'Gestor Master',  color: 'bg-purple-50 text-purple-700 border border-purple-200' },
  supervisor_adm: { label: 'Supervisor',      color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  atendimento:    { label: 'Atendimento',     color: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

const DEPT_LABELS: Record<string, string> = {
  comercial: 'ADM Comercial', cadastro: 'Cadastro', financeiro: 'Financeiro',
  operacional: 'Operacional', rede: 'Rede', marketing: 'Marketing',
  juridico: 'Juridico', logistica: 'Logistica',
}

const EMPTY = { full_name: '', email: '', phone: '', role: 'atendimento' as const, department: 'comercial' }

export default function UsuariosPage() {
  const supabase = createClient()
  const [attendants, setAttendants] = useState<Attendant[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { fetchAttendants() }, [])

  async function fetchAttendants() {
    setLoading(true)
    const { data } = await supabase
      .from('attendants')
      .select('*')
      .order('full_name')
    setAttendants((data as Attendant[]) ?? [])
    setLoading(false)
  }

  function openNew() { setForm(EMPTY); setEditingId(null); setError(''); setShowModal(true) }

  function openEdit(a: Attendant) {
    setForm({
      full_name:  a.full_name,
      email:      a.email ?? '',
      phone:      a.phone ?? '',
      role:       a.role,
      department: a.department ?? 'comercial',
    })
    setEditingId(a.id); setError(''); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nome e obrigatorio'); return }
    setSaving(true)
    const payload = {
      full_name:  form.full_name.trim(),
      email:      form.email || null,
      phone:      form.phone || null,
      role:       form.role,
      department: form.department || null,
      updated_at: new Date().toISOString(),
    }
    const { error: err } = editingId
      ? await supabase.from('attendants').update(payload).eq('id', editingId)
      : await supabase.from('attendants').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false); fetchAttendants()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('attendants').update({ active: !active }).eq('id', id)
    fetchAttendants()
  }

  const activeList   = attendants.filter(a => a.active && a.id !== 'aaaaaaaa-0000-0000-0000-000000000001')
  const inactiveList = attendants.filter(a => !a.active)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Atendentes</h1>
          <p className="text-xs text-gray-400 mt-0.5">{activeList.length} atendentes ativos</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={15} /> Novo atendente</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Equipe ativa</span>
              <span className="text-xs text-gray-400">{activeList.length} pessoas</span>
            </div>
            <div className="table-header grid" style={{ gridTemplateColumns: '1fr 160px 140px 120px 100px' }}>
              <span>Nome</span><span>Departamento</span><span>Funcao</span><span>Contato</span><span>Acoes</span>
            </div>
            {activeList.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                Nenhum atendente cadastrado — clique em "Novo atendente"
              </div>
            ) : activeList.map(a => (
              <div key={a.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 160px 140px 120px 100px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-semibold flex-shrink-0">
                    {a.full_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{a.full_name}</div>
                    {a.email && <div className="text-xs text-gray-400">{a.email}</div>}
                  </div>
                </div>
                <span className="text-sm text-gray-600">{DEPT_LABELS[a.department ?? ''] ?? a.department ?? '—'}</span>
                <span className={cn('badge', ROLE_CONFIG[a.role].color)}>{ROLE_CONFIG[a.role].label}</span>
                <span className="text-xs text-gray-500">{a.phone ?? '—'}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" title="Editar">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => toggleActive(a.id, a.active)} className="px-2 py-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 text-xs">
                    Desativar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {inactiveList.length > 0 && (
            <div className="card opacity-60">
              <div className="card-header">
                <span className="card-title text-gray-400">Inativos</span>
                <span className="text-xs text-gray-400">{inactiveList.length}</span>
              </div>
              {inactiveList.map(a => (
                <div key={a.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 160px 140px 120px 100px' }}>
                  <div className="text-sm text-gray-400 line-through">{a.full_name}</div>
                  <span className="text-xs text-gray-400">{DEPT_LABELS[a.department ?? ''] ?? '—'}</span>
                  <span className={cn('badge opacity-50', ROLE_CONFIG[a.role].color)}>{ROLE_CONFIG[a.role].label}</span>
                  <span className="text-xs text-gray-400">{a.phone ?? '—'}</span>
                  <button onClick={() => toggleActive(a.id, a.active)} className="text-xs text-[#185FA5] hover:underline">Reativar</button>
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
              <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Editar atendente' : 'Novo atendente'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Nome completo *</label>
                <input className="input" placeholder="Nome do atendente" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input className="input" type="email" placeholder="email@vegascard.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="input" placeholder="(11) 99999-0000" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Funcao *</label>
                  <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                    <option value="atendimento">Atendimento</option>
                    <option value="supervisor_adm">Supervisor</option>
                    <option value="gestor_master">Gestor Master</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Departamento</label>
                  <select className="select" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    <option value="comercial">ADM Comercial</option>
                    <option value="cadastro">Cadastro</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="operacional">Operacional</option>
                    <option value="rede">Rede</option>
                    <option value="marketing">Marketing</option>
                    <option value="juridico">Juridico</option>
                    <option value="logistica">Logistica</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Cadastrar atendente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
