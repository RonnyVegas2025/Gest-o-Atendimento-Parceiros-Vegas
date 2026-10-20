'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Check, Clock, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDepartments } from '@/hooks/useDepartments'
import { useEquipes } from '@/hooks/useEquipes'
import type { Department } from '@/hooks/useDepartments'
import type { Equipe } from '@/hooks/useEquipes'

interface TicketType {
  id: string
  name: string
  description: string | null
  category: string | null
  subcategory: string | null
  department: string | null
  equipe_id: string | null
  priority: 'baixa' | 'media' | 'alta'
  sla_hours: number
  active: boolean
}

interface Subtipo {
  id: string
  ticket_type_id: string
  nome: string
  descricao: string | null
  department: string | null
  equipe_id: string | null
  active: boolean
  ordem: number | null
  sla_hours: number | null
}

const EMPTY_SUB = { nome: '', descricao: '', department: '', equipe_id: '', ordem: 0, sla_hours: '' }

// ─── Gestão de subtipos de um tipo (segundo nível de classificação) ───────────
function SubtiposModal({
  type, departments, deptLabels, equipes, equipeLabels, onClose, onChanged,
}: {
  type: TicketType
  departments: Department[]
  deptLabels: Record<string, string>
  equipes: Equipe[]
  equipeLabels: Record<string, string>
  onClose: () => void
  onChanged: () => void
}) {
  const supabase = createClient()
  const [subs, setSubs]       = useState<Subtipo[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState(EMPTY_SUB)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function fetchSubs() {
    setLoading(true)
    const { data } = await supabase.from('ticket_subtipos').select('*')
      .eq('ticket_type_id', type.id).order('ordem').order('nome')
    setSubs((data as Subtipo[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { fetchSubs() }, [type.id])

  function resetForm() { setForm(EMPTY_SUB); setEditingId(null); setError('') }
  function openEdit(s: Subtipo) {
    setForm({ nome: s.nome, descricao: s.descricao ?? '', department: s.department ?? '', equipe_id: s.equipe_id ?? '', ordem: s.ordem ?? 0, sla_hours: s.sla_hours != null ? String(s.sla_hours) : '' })
    setEditingId(s.id); setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setError('Nome e obrigatorio'); return }
    setSaving(true)
    const payload = {
      ticket_type_id: type.id,
      nome:       form.nome.trim(),
      descricao:  form.descricao.trim() || null,
      department: form.department || null,
      equipe_id:  form.equipe_id || null,
      ordem:      Number(form.ordem) || 0,
      sla_hours:  form.sla_hours ? Number(form.sla_hours) : null,
    }
    const { error: err } = editingId
      ? await supabase.from('ticket_subtipos').update(payload).eq('id', editingId)
      : await supabase.from('ticket_subtipos').insert({ ...payload, active: true })
    setSaving(false)
    if (err) { setError(err.message); return }
    resetForm(); fetchSubs(); onChanged()
  }

  // Inativar (nunca excluir) — e reativar.
  async function toggleActive(s: Subtipo) {
    await supabase.from('ticket_subtipos').update({ active: !s.active }).eq('id', s.id)
    fetchSubs(); onChanged()
  }

  const ativos   = subs.filter(s => s.active)
  const inativos = subs.filter(s => !s.active)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Layers size={15} className="text-[#185FA5]" /> Subtipos de {type.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">A causa, descoberta na analise, define o departamento e a equipe de quem resolve.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Lista de subtipos ativos */}
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">Carregando...</div>
          ) : (
            <>
              <div className="card overflow-hidden">
                <div className="table-header grid text-xs" style={{ gridTemplateColumns: '48px minmax(0,1fr) 130px 140px 90px auto' }}>
                  <span>Ordem</span><span>Nome / Descricao</span><span>Departamento</span><span>Equipe</span><span>SLA</span><span>Acoes</span>
                </div>
                {ativos.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400">Nenhum subtipo ativo. Cadastre abaixo.</div>
                ) : ativos.map(s => (
                  <div key={s.id} className="table-row grid items-center" style={{ gridTemplateColumns: '48px minmax(0,1fr) 130px 140px 90px auto' }}>
                    <span className="text-xs text-gray-400">{s.ordem ?? 0}</span>
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-medium text-gray-900 break-words">{s.nome}</div>
                      {s.descricao && <div className="text-xs text-gray-400 break-words">{s.descricao}</div>}
                    </div>
                    <span className="text-xs truncate">
                      {s.department ? <span className="text-gray-600">{deptLabels[s.department] ?? s.department}</span> : <span className="text-gray-300">—</span>}
                    </span>
                    <span className="text-xs truncate">
                      {s.equipe_id ? <span className="text-gray-600">{equipeLabels[s.equipe_id] ?? 'Equipe inativa'}</span> : <span className="text-gray-300">—</span>}
                    </span>
                    <span className="text-xs">
                      {s.sla_hours != null
                        ? <span className="inline-flex items-center gap-1 text-gray-600"><Clock size={11} className="text-gray-400" />{s.sla_hours}h</span>
                        : <span className="text-gray-300" title="Usa o SLA do tipo">—</span>}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => toggleActive(s)} className="px-2 py-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 text-xs">Inativar</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Inativos */}
              {inativos.length > 0 && (
                <div className="card opacity-60 overflow-hidden">
                  <div className="card-header"><span className="card-title text-gray-400">Subtipos inativos</span><span className="text-xs text-gray-400">{inativos.length}</span></div>
                  {inativos.map(s => (
                    <div key={s.id} className="table-row grid" style={{ gridTemplateColumns: '1fr 150px' }}>
                      <span className="text-sm text-gray-400 line-through self-center truncate">{s.nome}</span>
                      <button onClick={() => toggleActive(s)} className="text-xs text-[#185FA5] hover:underline self-center text-left">Reativar</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário de cadastro/edição */}
              <form onSubmit={save} className="card p-4 space-y-4 border-blue-100">
                <div className="text-xs font-semibold text-gray-600">{editingId ? 'Editar subtipo' : 'Novo subtipo'}</div>
                <div className="grid grid-cols-[1fr_80px_170px] gap-4">
                  <div className="form-group">
                    <label className="form-label">Nome *</label>
                    <input className="input" placeholder="Ex: Servico nao liberado no contrato" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ordem</label>
                    <input className="input" type="number" min={0} value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SLA (prazo) <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <select className="select" value={form.sla_hours} onChange={e => setForm(f => ({ ...f, sla_hours: e.target.value }))}>
                      <option value="">Usa o SLA do tipo</option>
                      {SLA_OPTIONS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descricao <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input className="input" placeholder="Breve descricao da causa..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Departamento que resolve <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <select className="select" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                      <option value="">Sem departamento</option>
                      {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Equipe responsavel <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <select className="select" value={form.equipe_id} onChange={e => setForm(f => ({ ...f, equipe_id: e.target.value }))}>
                      <option value="">Sem equipe</option>
                      {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
                    </select>
                  </div>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
                <div className="flex justify-end gap-2">
                  {editingId && <button type="button" onClick={resetForm} className="btn btn-sm">Cancelar edicao</button>}
                  <button type="submit" disabled={saving} className="btn-primary btn-sm">{saving ? 'Salvando...' : editingId ? 'Salvar subtipo' : 'Adicionar subtipo'}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PRIORITY_CONFIG = {
  alta:  { label: 'Alta',  color: 'bg-red-50 text-red-700 border border-red-200',       dot: 'bg-red-500' },
  media: { label: 'Media', color: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
  baixa: { label: 'Baixa', color: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
}

const SLA_OPTIONS = [
  { value: 1,  label: '1 hora' },
  { value: 2,  label: '2 horas' },
  { value: 4,  label: '4 horas' },
  { value: 6,  label: '6 horas' },
  { value: 8,  label: '8 horas' },
  { value: 12, label: '12 horas' },
  { value: 24, label: '24 horas (1 dia)' },
  { value: 48, label: '48 horas (2 dias)' },
  { value: 72, label: '72 horas (3 dias)' },
]

const EMPTY = {
  name: '', description: '', category: '', subcategory: '', department: '', equipe_id: '',
  priority: 'media' as 'baixa' | 'media' | 'alta', sla_hours: 8
}

// Normaliza texto para busca: sem acento e case-insensitive.
const normalize = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Sentinela para os filtros "Sem departamento" / "Sem equipe".
const SEM = '__none__'

export default function TiposPage() {
  const supabase = createClient()
  const { departments, deptLabels, loading: deptLoading } = useDepartments()
  const { equipes, equipeLabels, loading: equipesLoading } = useEquipes()
  const [types, setTypes]         = useState<TicketType[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState(EMPTY)
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})
  const [categoryInput, setCategoryInput] = useState('')
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  // Barra de filtros combináveis
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('')
  const [deptFilter, setDeptFilter]   = useState('')
  const [equipeFilter, setEquipeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'inativos' | 'todos'>('ativos')
  const [subFilter, setSubFilter]     = useState<'' | 'com' | 'sem'>('')
  // Subtipos: contagem de ativos por tipo + tipo cujo gerenciador está aberto
  const [subCounts, setSubCounts] = useState<Record<string, number>>({})
  const [subtiposType, setSubtiposType] = useState<TicketType | null>(null)

  useEffect(() => { fetchTypes(); fetchSubCounts() }, [])

  async function fetchTypes() {
    setLoading(true)
    const { data } = await supabase.from('ticket_types').select('*').order('category').order('name')
    setTypes((data as TicketType[]) ?? [])
    setLoading(false)
  }

  // Quantidade de subtipos ATIVOS por tipo (para exibir na listagem).
  async function fetchSubCounts() {
    const { data } = await supabase.from('ticket_subtipos').select('ticket_type_id').eq('active', true).limit(5000)
    const map: Record<string, number> = {}
    for (const r of (data as any[]) ?? []) map[r.ticket_type_id] = (map[r.ticket_type_id] ?? 0) + 1
    setSubCounts(map)
  }

  // Aplica todos os filtros combináveis (busca, categoria, departamento,
  // equipe, status e subtipos).
  const visible = useMemo(() => {
    const q = normalize(search.trim())
    return types.filter(t => {
      if (statusFilter === 'ativos'   && !t.active) return false
      if (statusFilter === 'inativos' &&  t.active) return false
      if (q && !(normalize(t.name).includes(q) || normalize(t.category).includes(q) || normalize(t.description).includes(q))) return false
      if (catFilter && (t.category ?? '') !== catFilter) return false
      if (deptFilter === SEM ? !!t.department : deptFilter && t.department !== deptFilter) return false
      if (equipeFilter === SEM ? !!t.equipe_id : equipeFilter && t.equipe_id !== equipeFilter) return false
      if (subFilter === 'com' && (subCounts[t.id] ?? 0) === 0) return false
      if (subFilter === 'sem' && (subCounts[t.id] ?? 0) > 0)  return false
      return true
    })
  }, [types, search, catFilter, deptFilter, equipeFilter, statusFilter, subFilter, subCounts])

  // Contadores do cabeçalho (sobre o resultado filtrado)
  const counts = useMemo(() => ({
    total: visible.length,
    semEquipe: visible.filter(t => !t.equipe_id).length,
    semDept: visible.filter(t => !t.department).length,
  }), [visible])

  // Agrupa por categoria (mantido)
  const grouped = useMemo(() => {
    const map: Record<string, TicketType[]> = {}
    visible.forEach(t => {
      const cat = t.category || 'Sem categoria'
      if (!map[cat]) map[cat] = []
      map[cat].push(t)
    })
    return map
  }, [visible])

  const categories = useMemo(() => Array.from(new Set(types.map(t => t.category).filter(Boolean))) as string[], [types])

  // Algum filtro ativo? (status padrão é "ativos")
  const anyFilter = !!search || !!catFilter || !!deptFilter || !!equipeFilter || !!subFilter || statusFilter !== 'ativos'
  function clearFilters() {
    setSearch(''); setCatFilter(''); setDeptFilter(''); setEquipeFilter(''); setSubFilter(''); setStatusFilter('ativos')
  }

  function openNew() {
    setForm(EMPTY)
    setCategoryInput('')
    setEditingId(null)
    setError('')
    setShowModal(true)
  }

  function openEdit(t: TicketType) {
    setForm({
      name: t.name, description: t.description ?? '',
      category: t.category ?? '', subcategory: t.subcategory ?? '',
      department: t.department ?? '',
      equipe_id: t.equipe_id ?? '',
      priority: t.priority, sla_hours: t.sla_hours
    })
    setCategoryInput(t.category ?? '')
    setEditingId(t.id)
    setError('')
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome e obrigatorio'); return }
    setSaving(true)
    const payload = {
      name:        form.name.trim(),
      description: form.description || null,
      category:    categoryInput.trim() || null,
      subcategory: form.subcategory.trim() || null,
      department:  form.department || null,
      equipe_id:   form.equipe_id || null,
      priority:    form.priority,
      sla_hours:   form.sla_hours,
      updated_at:  new Date().toISOString(),
    }
    const { error: err } = editingId
      ? await supabase.from('ticket_types').update(payload).eq('id', editingId)
      : await supabase.from('ticket_types').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false)
    fetchTypes()
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

  function toggleCategory(cat: string) {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tipos de Solicitacao</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {counts.total} tipo{counts.total !== 1 ? 's' : ''}
            {' · '}<span className={counts.semEquipe ? 'text-amber-600' : ''}>{counts.semEquipe} sem equipe</span>
            {' · '}<span className={counts.semDept ? 'text-amber-600' : ''}>{counts.semDept} sem departamento</span>
          </p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={15} /> Novo tipo</button>
      </div>

      {/* Barra de filtros combináveis */}
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input max-w-xs" placeholder="Buscar por nome, categoria ou descricao..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select w-44" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-44" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} disabled={deptLoading}>
          <option value="">Todos os depto.</option>
          <option value={SEM}>Sem departamento</option>
          {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select className="select w-44" value={equipeFilter} onChange={e => setEquipeFilter(e.target.value)} disabled={equipesLoading}>
          <option value="">Todas as equipes</option>
          <option value={SEM}>Sem equipe</option>
          {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
        </select>
        <select className="select w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <select className="select w-40" value={subFilter} onChange={e => setSubFilter(e.target.value as any)}>
          <option value="">Todos (subtipos)</option>
          <option value="com">Com subtipos</option>
          <option value="sem">Sem subtipos</option>
        </select>
        {anyFilter && (
          <button onClick={clearFilters} className="btn btn-sm text-xs flex items-center gap-1">
            <X size={13} /> Limpar filtros
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
        <Clock size={14} className="flex-shrink-0 mt-0.5" />
        <span>O SLA e a prioridade sao preenchidos automaticamente ao abrir um atendimento com base no tipo selecionado.</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* Agrupado por categoria */}
          {Object.keys(grouped).length === 0 ? (
            <div className="card py-12 text-center text-sm text-gray-400">
              Nenhum tipo encontrado com os filtros atuais.
              {anyFilter && <> <button onClick={clearFilters} className="text-[#185FA5] hover:underline">Limpar filtros</button></>}
            </div>
          ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([cat, items]) => {
              const isOpen = expanded[cat] !== false // aberto por padrão
              return (
                <div key={cat} className="card overflow-hidden">
                  {/* Header da categoria */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full card-header hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      <span className="card-title">{cat}</span>
                      <span className="text-xs text-gray-400 font-normal">({items.length} tipo{items.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                     {Array.from(new Set(items.map(i => i.subcategory).filter(Boolean))).slice(0,4).map(sub => (
                        <span key={sub} className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">{sub}</span>
                      ))}
                    </div>
                  </button>

                  {isOpen && (
                    <>
                      <div className="table-header grid" style={{ gridTemplateColumns: '1fr 120px 120px 110px 150px 95px 90px 130px' }}>
                        <span>Nome / Subcategoria</span><span>Departamento</span><span>Equipe</span><span>SLA</span><span>Descricao</span><span>Prioridade</span><span>Status</span><span>Acoes</span>
                      </div>
                      {items.map(type => (
                        <div key={type.id} className={cn('table-row grid', !type.active && 'opacity-60')} style={{ gridTemplateColumns: '1fr 120px 120px 110px 150px 95px 90px 130px' }}>
                          <div>
                            <div className={cn('text-sm font-medium', type.active ? 'text-gray-900' : 'text-gray-400 line-through')}>{type.name}</div>
                            {type.subcategory && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600">
                                {type.subcategory}
                              </span>
                            )}
                            <button
                              onClick={() => setSubtiposType(type)}
                              className="mt-1 flex items-center gap-1 text-[11px] text-[#185FA5] hover:underline"
                              title="Gerenciar subtipos (segundo nivel de classificacao)"
                            >
                              <Layers size={11} />
                              Subtipos
                              <span className={cn('px-1.5 rounded-full text-[10px] font-semibold', (subCounts[type.id] ?? 0) > 0 ? 'bg-blue-50 text-[#185FA5]' : 'bg-gray-100 text-gray-400')}>
                                {subCounts[type.id] ?? 0}
                              </span>
                            </button>
                          </div>
                          <span className="text-xs self-center truncate">
                            {type.department ? <span className="text-gray-600">{deptLabels[type.department] ?? type.department}</span> : <span className="text-amber-500" title="Sem departamento">—</span>}
                          </span>
                          <span className="text-xs self-center truncate">
                            {type.equipe_id ? <span className="text-gray-600">{equipeLabels[type.equipe_id] ?? 'Equipe inativa'}</span> : <span className="text-amber-500" title="Sem equipe">—</span>}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-gray-700 self-center">
                            <Clock size={11} className="text-gray-400" />
                            {SLA_OPTIONS.find(s => s.value === type.sla_hours)?.label ?? type.sla_hours + 'h'}
                          </div>
                          <div className="text-xs text-gray-400 self-center truncate">{type.description || '—'}</div>
                          <span className={cn('badge self-center', PRIORITY_CONFIG[type.priority].color)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[type.priority].dot)} />
                            {PRIORITY_CONFIG[type.priority].label}
                          </span>
                          {type.active ? (
                            <span className="badge self-center bg-green-50 text-green-700 border border-green-200">
                              <Check size={10} /> Ativo
                            </span>
                          ) : (
                            <span className="badge self-center bg-gray-100 text-gray-500 border border-gray-200">Inativo</span>
                          )}
                          <div className="flex items-center gap-1 self-center">
                            <button onClick={() => openEdit(type)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Editar">
                              <Pencil size={12} />
                            </button>
                            {type.active ? (
                              <>
                                <button onClick={() => toggleActive(type.id, type.active)} className="px-2 py-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 text-xs">
                                  Desativar
                                </button>
                                <button onClick={() => deleteType(type.id, type.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => toggleActive(type.id, type.active)} className="px-2 py-1 rounded-lg hover:bg-green-50 text-[#185FA5] hover:text-green-700 text-xs">
                                Reativar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </>
      )}

      {/* Gerenciador de subtipos */}
      {subtiposType && (
        <SubtiposModal
          type={subtiposType}
          departments={departments}
          deptLabels={deptLabels}
          equipes={equipes}
          equipeLabels={equipeLabels}
          onClose={() => setSubtiposType(null)}
          onChanged={fetchSubCounts}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Editar tipo' : 'Novo tipo de solicitacao'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">

              {/* Categoria */}
              <div className="form-group">
                <label className="form-label">Categoria *</label>
                <div className="relative">
                  <input
                    className="input"
                    placeholder="Ex: Cartao, Financeiro, Colaborador..."
                    value={categoryInput}
                    onChange={e => { setCategoryInput(e.target.value); setShowCatDropdown(true) }}
                    onFocus={() => setShowCatDropdown(true)}
                    required
                  />
                  {showCatDropdown && categories.filter(c => c && c.toLowerCase().includes(categoryInput.toLowerCase())).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                      {categories.filter(c => c && c.toLowerCase().includes(categoryInput.toLowerCase())).map(c => (
                        <button key={c} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                          onClick={() => { setCategoryInput(c!); setShowCatDropdown(false) }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Digite uma existente ou crie uma nova categoria</p>
              </div>

              {/* Subcategoria */}
              <div className="form-group">
                <label className="form-label">Subcategoria <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input
                  className="input"
                  placeholder="Ex: Prorrogar Boleto, Reenvio, Boleto Errado..."
                  value={form.subcategory}
                  onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                />
              </div>

              {/* Departamento e Equipe (opcionais) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Departamento <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <select className="select" value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))} disabled={deptLoading}>
                    <option value="">Sem departamento</option>
                    {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Ao definir, este tipo aparece só para o departamento no novo atendimento.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Equipe responsável <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <select className="select" value={form.equipe_id}
                    onChange={e => setForm(f => ({ ...f, equipe_id: e.target.value }))} disabled={equipesLoading}>
                    <option value="">Sem equipe</option>
                    {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Preenche a equipe do atendimento automaticamente ao escolher este tipo.</p>
                </div>
              </div>

              {/* Nome */}
              <div className="form-group">
                <label className="form-label">Nome do tipo *</label>
                <input
                  className="input"
                  placeholder="Ex: Prorrogacao de Boleto"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              {/* Descrição */}
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
                <div className="font-medium text-gray-600 mb-1">Preview:</div>
                {categoryInput && (
                  <div className="text-gray-500">
                    Caminho: <strong>{categoryInput}</strong>
                    {form.subcategory ? <> › <strong>{form.subcategory}</strong></> : null}
                    {form.name ? <> › <strong>{form.name}</strong></> : null}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('badge', PRIORITY_CONFIG[form.priority].color)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[form.priority].dot)} />
                    {PRIORITY_CONFIG[form.priority].label}
                  </span>
                  <span className="flex items-center gap-1 text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    <Clock size={10} />
                    {SLA_OPTIONS.find(s => s.value === form.sla_hours)?.label ?? form.sla_hours + 'h'}
                  </span>
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
