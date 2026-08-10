'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info, Search, X } from 'lucide-react'
import PasteTextarea from '@/components/ui/PasteTextarea'
import { useDepartments } from '@/hooks/useDepartments'

/*
 * NOVA OCORRÊNCIA — registro de erros por departamento (análise de causa raiz).
 *
 * Schema assumido para `ocorrencias` (tabela já existente; ajustar aqui se diferir):
 *   protocolo (gerado por trigger — inserimos vazio e lemos de volta),
 *   departamento (value do departamento), tipo_erro_id, titulo, observacao,
 *   imagens (array de URLs), company_id, ticket_id, responsavel_id,
 *   gravidade ('baixa'|'media'|'alta'), data_ocorrencia (date), status, created_by.
 * `tipos_erro`: id, departamento, nome, active.
 */

const GRAVIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta',  label: 'Alta' },
]

const normalizeText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const hoje = () => new Date().toISOString().slice(0, 10)

interface TipoErro { id: string; departamento: string; nome: string; active: boolean }

export default function NovaOcorrenciaPage() {
  const supabase = createClient()
  const router = useRouter()
  const { departments, loading: deptLoading } = useDepartments()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('00000000-0000-0000-0000-000000000001')

  // Listas de apoio
  const [tiposErro, setTiposErro] = useState<TipoErro[]>([])
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [responsaveis, setResponsaveis] = useState<{ id: string; full_name: string }[]>([])

  // Empresa (autocomplete opcional) — mesmas fontes do novo atendimento
  const [companies, setCompanies] = useState<{ id: string; legal_name: string; trade_name: string; cnpj: string }[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; legal_name: string; trade_name: string } | null>(null)
  const [showCompanyDrop, setShowCompanyDrop] = useState(false)
  const companyBoxRef = useRef<HTMLDivElement>(null)

  // Atendimento relacionado (busca por protocolo)
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketResults, setTicketResults] = useState<{ id: string; protocol: string }[]>([])
  const [selectedTicket, setSelectedTicket] = useState<{ id: string; protocol: string } | null>(null)
  const [showTicketDrop, setShowTicketDrop] = useState(false)
  const ticketBoxRef = useRef<HTMLDivElement>(null)

  const [imagens, setImagens] = useState<string[]>([])
  const [form, setForm] = useState({
    departamento: '',
    tipo_erro_id: '',
    titulo: '',
    observacao: '',
    responsavel_id: '',
    gravidade: 'media',
    data_ocorrencia: hoje(),
  })

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
  }

  // Usuário logado + listas iniciais
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users_profile').select('id').eq('email', user.email ?? '').maybeSingle()
      if (data?.id) setCurrentUserId(data.id)
    })

    supabase.from('users_profile').select('id, full_name').order('full_name')
      .then(({ data }) => setResponsaveis((data as any[]) ?? []))

    Promise.all([
      supabase.from('companies').select('id, legal_name, trade_name, cnpj').eq('status', 'ativa').order('legal_name'),
      supabase.from('empresas_conveniadas').select('id, nome_fantasia, razao_social, cnpj').eq('ativo', true).order('nome_fantasia').limit(5000),
    ]).then(([{ data: comp }, { data: conv }]) => {
      const a = (comp ?? []).map((c: any) => ({ id: c.id, legal_name: c.legal_name, trade_name: c.trade_name, cnpj: c.cnpj }))
      const b = (conv ?? []).map((c: any) => ({ id: c.id, legal_name: c.nome_fantasia, trade_name: c.razao_social || c.nome_fantasia, cnpj: c.cnpj }))
      setCompanies([...a, ...b] as any)
    })
  }, [])

  // Recarrega tipos de erro sempre que o departamento muda
  useEffect(() => {
    set('tipo_erro_id', '')
    if (!form.departamento) { setTiposErro([]); return }
    let active = true
    setLoadingTipos(true)
    supabase.from('tipos_erro')
      .select('id, departamento, nome, active')
      .eq('departamento', form.departamento)
      .eq('active', true)
      .order('nome')
      .then(({ data }) => {
        if (!active) return
        setTiposErro((data as TipoErro[]) ?? [])
        setLoadingTipos(false)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.departamento])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (companyBoxRef.current && !companyBoxRef.current.contains(e.target as Node)) setShowCompanyDrop(false)
      if (ticketBoxRef.current && !ticketBoxRef.current.contains(e.target as Node)) setShowTicketDrop(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filteredCompanies = useMemo(() => {
    if (!companySearch || companySearch.length < 2) return []
    const q = normalizeText(companySearch)
    const digits = companySearch.replace(/\D/g, '')
    return companies.filter(c =>
      normalizeText(c.legal_name ?? '').includes(q) ||
      normalizeText(c.trade_name ?? '').includes(q) ||
      (digits.length >= 3 && (c.cnpj ?? '').replace(/\D/g, '').includes(digits))
    ).slice(0, 6)
  }, [companySearch, companies])

  // Busca de atendimento por protocolo (debounce simples)
  useEffect(() => {
    const q = ticketSearch.trim()
    if (selectedTicket || q.length < 3) { setTicketResults([]); return }
    let active = true
    const t = setTimeout(() => {
      supabase.from('tickets').select('id, protocol').ilike('protocol', `%${q}%`).limit(6)
        .then(({ data }) => { if (active) setTicketResults((data as any[]) ?? []) })
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [ticketSearch, selectedTicket])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.departamento) { setError('Selecione o departamento.'); return }
    if (!form.tipo_erro_id) { setError('Selecione o tipo de erro.'); return }
    if (!form.titulo.trim()) { setError('Informe o título específico.'); return }
    setLoading(true)

    // protocolo gerado por trigger no banco (inserimos vazio e lemos de volta) — mesma lógica dos atendimentos
    const payload: Record<string, unknown> = {
      protocolo:        '',
      departamento:     form.departamento,
      tipo_erro_id:     form.tipo_erro_id,
      titulo:           form.titulo.trim(),
      observacao:       form.observacao.trim() || null,
      imagens:          imagens.length > 0 ? imagens : null,
      company_id:       selectedCompany?.id ?? null,
      ticket_id:        selectedTicket?.id ?? null,
      responsavel_id:   form.responsavel_id || null,
      gravidade:        form.gravidade,
      data_ocorrencia:  form.data_ocorrencia || hoje(),
      status:           'aberta',
      created_by:       currentUserId,
    }

    const { data, error: err } = await supabase.from('ocorrencias').insert(payload).select('id').single()
    if (err || !data) { setError(err?.message ?? 'Erro ao salvar a ocorrência.'); setLoading(false); return }

    setLoading(false)
    router.push('/ocorrencias/' + data.id)
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ocorrencias" className="btn btn-sm"><ArrowLeft size={14} /></Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Nova ocorrência</h1>
            <p className="text-xs text-gray-400">Registro de erro por departamento · protocolo gerado automaticamente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Classificação */}
          <div className="card">
            <div className="card-header"><span className="card-title">Classificação</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Departamento *</label>
                  <select className="select" value={form.departamento} onChange={e => set('departamento', e.target.value)} disabled={deptLoading} required>
                    <option value="">Selecione o departamento...</option>
                    {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de erro *</label>
                  <select className="select" value={form.tipo_erro_id} onChange={e => set('tipo_erro_id', e.target.value)}
                    disabled={!form.departamento || loadingTipos} required>
                    <option value="">
                      {!form.departamento ? 'Selecione o departamento antes' : loadingTipos ? 'Carregando...' : tiposErro.length === 0 ? 'Nenhum tipo para este departamento' : 'Selecione o tipo de erro...'}
                    </option>
                    {tiposErro.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Título específico *</label>
                <input className="input" placeholder="Resumo objetivo do erro" value={form.titulo} onChange={e => set('titulo', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Gravidade *</label>
                  <select className="select" value={form.gravidade} onChange={e => set('gravidade', e.target.value)}>
                    {GRAVIDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Data da ocorrência *</label>
                  <input type="date" className="input" value={form.data_ocorrencia} onChange={e => set('data_ocorrencia', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Descrição / evidências */}
          <div className="card">
            <div className="card-header"><span className="card-title">Descrição e evidências</span></div>
            <div className="card-body space-y-4">
              <div className="form-group">
                <label className="form-label">Observação</label>
                <PasteTextarea
                  value={form.observacao}
                  onChange={v => set('observacao', v)}
                  onImagesChange={setImagens}
                  placeholder="Descreva o que ocorreu, contexto e evidências. Use Ctrl+V para colar prints..."
                  rows={4}
                />
                {imagens.length > 0 && <p className="text-xs text-green-600 mt-1">✓ {imagens.length} imagem(ns) prontas para salvar</p>}
              </div>
            </div>
          </div>

          {/* Vínculos (opcionais) */}
          <div className="card">
            <div className="card-header"><span className="card-title">Vínculos <span className="text-gray-400 font-normal">(opcionais)</span></span></div>
            <div className="card-body space-y-4">
              {/* Empresa */}
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <div className="relative" ref={companyBoxRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <input className="input pl-9" placeholder="Digite o nome ou CNPJ..."
                    autoComplete="off"
                    value={selectedCompany ? (selectedCompany.trade_name || selectedCompany.legal_name) : companySearch}
                    onChange={e => { setCompanySearch(e.target.value); setSelectedCompany(null); setShowCompanyDrop(true) }}
                    onFocus={() => setShowCompanyDrop(true)} />
                  {selectedCompany && (
                    <button type="button" onClick={() => { setSelectedCompany(null); setCompanySearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
                  )}
                  {showCompanyDrop && !selectedCompany && filteredCompanies.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 border border-gray-200 rounded-xl shadow-lg bg-white max-h-48 overflow-y-auto">
                      {filteredCompanies.map(c => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => { setSelectedCompany(c); setShowCompanyDrop(false) }}>
                          <div className="text-sm font-medium text-gray-900">{c.trade_name || c.legal_name}</div>
                          <div className="text-xs text-gray-400 font-mono">{c.cnpj || '—'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Atendimento relacionado */}
              <div className="form-group">
                <label className="form-label">Atendimento relacionado</label>
                <div className="relative" ref={ticketBoxRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <input className="input pl-9" placeholder="Busque pelo protocolo do atendimento..."
                    autoComplete="off"
                    value={selectedTicket ? selectedTicket.protocol : ticketSearch}
                    onChange={e => { setTicketSearch(e.target.value); setSelectedTicket(null); setShowTicketDrop(true) }}
                    onFocus={() => setShowTicketDrop(true)} />
                  {selectedTicket && (
                    <button type="button" onClick={() => { setSelectedTicket(null); setTicketSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
                  )}
                  {showTicketDrop && !selectedTicket && ticketResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 border border-gray-200 rounded-xl shadow-lg bg-white max-h-48 overflow-y-auto">
                      {ticketResults.map(t => (
                        <button key={t.id} type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors font-mono text-sm text-gray-700"
                          onClick={() => { setSelectedTicket(t); setShowTicketDrop(false) }}>
                          {t.protocol}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Responsável */}
              <div className="form-group">
                <label className="form-label">Pessoa responsável</label>
                <select className="select" value={form.responsavel_id} onChange={e => set('responsavel_id', e.target.value)}>
                  <option value="">Selecione a pessoa responsável...</option>
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>Protocolo gerado automaticamente (OCR-AAAAMMDD-NNNN). O registro nunca é excluído — pode ser cancelado depois.</span>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Link href="/ocorrencias" className="btn">Cancelar</Link>
            <button type="submit" disabled={loading} className="btn-primary min-w-[160px] justify-center">
              {loading ? 'Registrando...' : 'Registrar ocorrência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
