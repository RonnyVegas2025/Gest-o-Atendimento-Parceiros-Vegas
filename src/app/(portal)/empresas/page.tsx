'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, Plus, Upload, X, Loader2 } from 'lucide-react'

const PRODUTOS = ['Alimentação','Vegas Plus','Vegas Day','Aux. Combustível','Combustível Frota','Farmácia','Cartão Natal']
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const PROD_COLORS: Record<string,{bg:string;color:string}> = {
  'Alimentação':       { bg:'#E1F5EE', color:'#0F6E56' },
  'Vegas Plus':        { bg:'#EEEDFE', color:'#5B52C2' },
  'Vegas Day':         { bg:'#E6F1FB', color:'#185FA5' },
  'Aux. Combustível':  { bg:'#FAEEDA', color:'#854F0B' },
  'Combustível Frota': { bg:'#FAECE7', color:'#993C1D' },
  'Farmácia':          { bg:'#FCE8F0', color:'#8C1D4E' },
  'Cartão Natal':      { bg:'#FEF3E2', color:'#7A4200' },
}

const EMPTY_FORM = {
  nome_fantasia: '', razao_social: '', cnpj: '', id_grupo: '',
  municipio: '', uf: 'PR', telefone: '', email: '',
  endereco: '', bairro: '', cep: '', parceiro: 'Nex7 Participações',
  produtos: [] as string[],
  produto_ids: '',
  contato_rh_nome: '', contato_rh_telefone: '', contato_rh_email: '',
  contato_fin_nome: '', contato_fin_telefone: '', contato_fin_email: '',
}

export default function EmpresasPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [empresas, setEmpresas]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]           = useState('')
  const [filtroProd, setFiltroProd] = useState('')
  const [filtroUF, setFiltroUF]     = useState('')
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const PER_PAGE = 20

  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [saveOk, setSaveOk]         = useState(false)
  const [loadingCnpj, setLoadingCnpj] = useState(false)
  const [cnpjError, setCnpjError]   = useState('')

  const [showImport, setShowImport] = useState(false)
  const [csvRows, setCsvRows]       = useState<any[]>([])
  const [importing, setImporting]   = useState(false)
  const [importResult, setImportResult] = useState<{ok:number;err:number} | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('empresas_conveniadas')
      .select('id, cnpj, nome_fantasia, razao_social, uf, municipio, id_grupo, dados_enriquecidos, empresas_produtos(produto_nome)', { count: 'exact' })
      .eq('ativo', true)
      .order('nome_fantasia')
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (busca.trim()) {
      const digits = busca.trim().replace(/\D/g,'')
      if (digits.length >= 8) {
        query = query.ilike('cnpj', `%${digits}%`)
      } else if (/^\d+$/.test(busca.trim())) {
        const prodIds = await supabase.from('empresas_produtos').select('empresa_id').eq('produto_id', parseInt(busca.trim()))
        const ids = (prodIds.data ?? []).map((p: any) => p.empresa_id)
        if (ids.length > 0) query = query.in('id', ids)
        else query = query.eq('id_grupo', parseInt(busca.trim()))
      } else {
        query = query.or(`nome_fantasia.ilike.%${busca.trim()}%,razao_social.ilike.%${busca.trim()}%`)
      }
    }
    if (filtroUF) query = query.eq('uf', filtroUF)

    const { data, count } = await query
    let result = data ?? []
    if (filtroProd) {
      result = result.filter((e: any) => e.empresas_produtos?.some((p: any) => p.produto_nome === filtroProd))
    }
    setEmpresas(result)
    setTotal(count ?? 0)
    setLoading(false)
  }, [busca, filtroUF, filtroProd, page])

  useEffect(() => { load() }, [load])

  async function buscarCNPJ() {
    const cnpjLimpo = form.cnpj.replace(/\D/g,'')
    if (cnpjLimpo.length !== 14) { setCnpjError('CNPJ deve ter 14 dígitos'); return }
    setLoadingCnpj(true); setCnpjError('')
    try {
      const res = await fetch(`/api/cnpj/${cnpjLimpo}`)
      const data = await res.json()
      if (data.error) { setCnpjError('CNPJ não encontrado na Receita Federal'); setLoadingCnpj(false); return }
      setForm(f => ({
        ...f,
        razao_social:  data.razao_social ?? f.razao_social,
        nome_fantasia: f.nome_fantasia || data.nome_fantasia || data.razao_social || f.nome_fantasia,
        municipio:     data.municipio ?? f.municipio,
        uf:            data.uf ?? f.uf,
        cep:           data.cep?.replace(/\D/g,'').replace(/^(\d{5})(\d{3})$/, '$1-$2') ?? f.cep,
        endereco:      data.logradouro ? `${data.logradouro}${data.numero ? ', ' + data.numero : ''}` : f.endereco,
        bairro:        data.bairro ?? f.bairro,
        telefone:      data.ddd_telefone_1 ?? f.telefone,
        email:         data.email ?? f.email,
      }))
    } catch {
      setCnpjError('Erro ao consultar CNPJ')
    }
    setLoadingCnpj(false)
  }

  async function handleSave() {
    if (!form.nome_fantasia.trim()) { setSaveError('Nome fantasia é obrigatório'); return }
    setSaving(true); setSaveError('')
    const cnpjLimpo = form.cnpj.replace(/\D/g,'') || null
    const { data, error } = await supabase.from('empresas_conveniadas').insert({
      nome_fantasia:      form.nome_fantasia.trim(),
      razao_social:       form.razao_social.trim() || null,
      cnpj:               cnpjLimpo,
      id_grupo:           form.id_grupo ? parseInt(form.id_grupo) : null,
      municipio:          form.municipio.trim() || null,
      uf:                 form.uf || null,
      telefone:           form.telefone.trim() || null,
      email:              form.email.trim() || null,
      endereco:           form.endereco.trim() || null,
      bairro:             form.bairro.trim() || null,
      cep:                form.cep.trim() || null,
      parceiro:           form.parceiro.trim() || null,
      contato_rh_nome:    form.contato_rh_nome.trim() || null,
      contato_rh_telefone:form.contato_rh_telefone.trim() || null,
      contato_rh_email:   form.contato_rh_email.trim() || null,
      contato_fin_nome:   form.contato_fin_nome.trim() || null,
      contato_fin_telefone:form.contato_fin_telefone.trim() || null,
      contato_fin_email:  form.contato_fin_email.trim() || null,
      ativo:              true,
      dados_enriquecidos: false,
    }).select('id').single()

    if (error) { setSaveError(error.message); setSaving(false); return }

    // Salvar produtos com IDs
    if (form.produtos.length > 0 && data?.id) {
      const prodIds = form.produto_ids.split(',').map(s => s.trim()).filter(Boolean)
      await supabase.from('empresas_produtos').insert(
        form.produtos.map((p, i) => ({
          empresa_id:  data.id,
          produto_nome: p,
          produto_id:  prodIds[i] ? parseInt(prodIds[i]) : null,
        }))
      )
    }

    setSaving(false); setSaveOk(true)
    setTimeout(() => { setSaveOk(false); setShowModal(false); setForm(EMPTY_FORM); load() }, 1500)
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/"/g,''))
    return lines.slice(1).map(line => {
      const vals = line.split(';').map(v => v.trim().replace(/^"|"$/g,''))
      const obj: any = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    }).filter(r => r.nome_fantasia || r['nome fantasia'] || r.nome)
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setCsvRows(parseCSV(ev.target?.result as string)) }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (csvRows.length === 0) return
    setImporting(true)
    let ok = 0, err = 0
    for (const row of csvRows) {
      const nome = row.nome_fantasia || row['nome fantasia'] || row.nome || ''
      if (!nome) { err++; continue }
      const { error } = await supabase.from('empresas_conveniadas').insert({
        nome_fantasia: nome.trim(),
        razao_social:  row.razao_social || row['razão social'] || null,
        cnpj:          (row.cnpj || '').replace(/\D/g,'') || null,
        id_grupo:      row.id_grupo ? parseInt(row.id_grupo) : null,
        municipio:     row.municipio || row.cidade || null,
        uf:            row.uf || row.estado || null,
        telefone:      row.telefone || null,
        email:         row.email || null,
        parceiro:      row.parceiro || 'Nex7 Participações',
        ativo:         true,
        dados_enriquecidos: false,
      })
      if (error) err++; else ok++
    }
    setImporting(false); setImportResult({ ok, err })
    if (ok > 0) load()
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        {children}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Empresas Conveniadas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} empresas · Nex7 Participações</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn"><Upload size={14} /> Importar CSV</button>
          <button onClick={() => { setForm(EMPTY_FORM); setSaveError(''); setSaveOk(false); setCnpjError(''); setShowModal(true) }} className="btn-primary">
            <Plus size={14} /> Nova Empresa
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="CNPJ, nome fantasia, razão social, ID do produto ou grupo..."
            value={busca} onChange={e => { setBusca(e.target.value); setPage(0) }}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
        </div>
        <select value={filtroProd} onChange={e => { setFiltroProd(e.target.value); setPage(0) }}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
          <option value="">Todos os produtos</option>
          {PRODUTOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroUF} onChange={e => { setFiltroUF(e.target.value); setPage(0) }}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
          <option value="">Todos os estados</option>
          {UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{empresas.length} resultados</span>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns:'1fr 140px 80px 140px 1fr 90px 60px' }}>
          <span>Empresa</span><span>CNPJ</span><span>Grupo</span><span>Localidade</span><span>Produtos</span><span>Dados</span><span></span>
        </div>
        {loading && <div className="py-10 text-center text-sm text-gray-400">Carregando...</div>}
        {!loading && empresas.length === 0 && <div className="py-10 text-center text-sm text-gray-400">Nenhuma empresa encontrada.</div>}
        {!loading && empresas.map((e: any) => {
          const produtos: string[] = Array.from(new Set((e.empresas_produtos ?? []).map((p: any) => p.produto_nome as string)))
          return (
            <div key={e.id} className="table-row grid hover:bg-blue-50/30" style={{ gridTemplateColumns:'1fr 140px 80px 140px 1fr 90px 60px' }}>
              <div>
                <div className="text-sm font-medium text-gray-900 truncate">{e.nome_fantasia}</div>
                {e.razao_social && <div className="text-xs text-gray-400 truncate">{e.razao_social}</div>}
              </div>
              <span className="font-mono text-xs text-indigo-600 self-center">
                {e.cnpj ? e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : <span className="text-gray-300">—</span>}
              </span>
              <span className="self-center">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">{e.id_grupo}</span>
              </span>
              <span className="text-xs text-gray-500 self-center">{e.municipio} · <strong>{e.uf}</strong></span>
              <div className="flex flex-wrap gap-1 self-center">
                {produtos.map(p => {
                  const c = PROD_COLORS[p] ?? { bg:'#F1EFE8', color:'#5F5E5A' }
                  return <span key={p} style={{ background:c.bg, color:c.color }} className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">{p}</span>
                })}
              </div>
              <span className="self-center">
                {e.dados_enriquecidos
                  ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">✓ Completo</span>
                  : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Pendente</span>}
              </span>
              <span className="self-center">
                <Link href={`/empresas/${e.id}`}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="6.5" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                </Link>
              </span>
            </div>
          )
        })}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:border-indigo-300">‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-bold transition-colors ${page===i?'border-indigo-500 bg-indigo-500 text-white':'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                  {i+1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page>=totalPages-1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:border-indigo-300">›</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL NOVA EMPRESA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-sm font-semibold text-gray-900">Nova Empresa</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">

              {/* CNPJ com busca */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Identificação</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group col-span-2">
                    <label className="form-label">CNPJ</label>
                    <div className="flex gap-2">
                      <input className="input flex-1" placeholder="00.000.000/0000-00"
                        value={form.cnpj}
                        onChange={e => { setForm(f => ({...f, cnpj: e.target.value})); setCnpjError('') }} />
                      <button onClick={buscarCNPJ} disabled={loadingCnpj}
                        className="btn-primary px-4 flex-shrink-0 disabled:opacity-60">
                        {loadingCnpj ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
                      </button>
                    </div>
                    {cnpjError && <p className="text-xs text-red-500 mt-1">{cnpjError}</p>}
                    {!cnpjError && !loadingCnpj && form.razao_social && (
                      <p className="text-xs text-green-600 mt-1">✓ Dados preenchidos automaticamente</p>
                    )}
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Nome Fantasia *</label>
                    <input className="input" value={form.nome_fantasia} onChange={e => setForm(f => ({...f, nome_fantasia: e.target.value}))} placeholder="Nome fantasia da empresa" />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Razão Social</label>
                    <input className="input" value={form.razao_social} onChange={e => setForm(f => ({...f, razao_social: e.target.value}))} placeholder="Razão social" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ID Grupo</label>
                    <input className="input" type="number" value={form.id_grupo} onChange={e => setForm(f => ({...f, id_grupo: e.target.value}))} placeholder="Ex: 7532" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parceiro</label>
                    <select className="select" value={form.parceiro} onChange={e => setForm(f => ({...f, parceiro: e.target.value}))}>
                      <option value="">Selecione o parceiro...</option>
                      {parceiros.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Endereço</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group col-span-2">
                    <label className="form-label">Logradouro</label>
                    <input className="input" value={form.endereco} onChange={e => setForm(f => ({...f, endereco: e.target.value}))} placeholder="Rua, número" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bairro</label>
                    <input className="input" value={form.bairro} onChange={e => setForm(f => ({...f, bairro: e.target.value}))} placeholder="Bairro" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CEP</label>
                    <input className="input" value={form.cep} onChange={e => setForm(f => ({...f, cep: e.target.value}))} placeholder="00000-000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Município</label>
                    <input className="input" value={form.municipio} onChange={e => setForm(f => ({...f, municipio: e.target.value}))} placeholder="Cidade" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">UF</label>
                    <select className="select" value={form.uf} onChange={e => setForm(f => ({...f, uf: e.target.value}))}>
                      {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contato geral */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Contato Geral</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="input" value={form.telefone} onChange={e => setForm(f => ({...f, telefone: e.target.value}))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="input" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="email@empresa.com" />
                  </div>
                </div>
              </div>

              {/* Contato RH */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Contato RH</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Nome</label>
                    <input className="input" value={form.contato_rh_nome} onChange={e => setForm(f => ({...f, contato_rh_nome: e.target.value}))} placeholder="Nome do RH" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="input" value={form.contato_rh_telefone} onChange={e => setForm(f => ({...f, contato_rh_telefone: e.target.value}))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="input" value={form.contato_rh_email} onChange={e => setForm(f => ({...f, contato_rh_email: e.target.value}))} placeholder="rh@empresa.com" />
                  </div>
                </div>
              </div>

              {/* Contato Financeiro */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Contato Financeiro</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Nome</label>
                    <input className="input" value={form.contato_fin_nome} onChange={e => setForm(f => ({...f, contato_fin_nome: e.target.value}))} placeholder="Nome do financeiro" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="input" value={form.contato_fin_telefone} onChange={e => setForm(f => ({...f, contato_fin_telefone: e.target.value}))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-mail</label>
                    <input className="input" value={form.contato_fin_email} onChange={e => setForm(f => ({...f, contato_fin_email: e.target.value}))} placeholder="fin@empresa.com" />
                  </div>
                </div>
              </div>

              {/* Produtos */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Produtos Contratados</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRODUTOS.map(p => (
                    <button key={p} type="button"
                      onClick={() => setForm(f => ({...f, produtos: f.produtos.includes(p) ? f.produtos.filter(x=>x!==p) : [...f.produtos, p]}))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.produtos.includes(p) ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                {form.produtos.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">IDs dos Produtos (na ordem acima, separados por vírgula)</label>
                    <input className="input font-mono" value={form.produto_ids}
                      onChange={e => setForm(f => ({...f, produto_ids: e.target.value}))}
                      placeholder={`Ex: ${form.produtos.map((_,i) => 14771 + i).join(', ')}`} />
                    <p className="text-xs text-gray-400 mt-1">Digite os IDs na mesma ordem dos produtos selecionados acima</p>
                  </div>
                )}
              </div>

              {saveError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{saveError}</p>}
              {saveOk && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-100">✓ Empresa cadastrada com sucesso!</p>}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setShowModal(false)} className="btn">Cancelar</button>
                <button onClick={handleSave} disabled={saving || saveOk} className="btn-primary">
                  {saving ? 'Salvando...' : saveOk ? '✓ Salvo!' : 'Cadastrar empresa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAÇÃO CSV */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => !importing && setShowImport(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Importar Empresas via CSV</h2>
              <button onClick={() => setShowImport(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100 space-y-1">
                <div className="font-semibold">Formato esperado (separador ponto e vírgula):</div>
                <div className="font-mono text-[10px] break-all">nome_fantasia;razao_social;cnpj;id_grupo;municipio;uf;telefone;email;parceiro</div>
                <div className="text-blue-600 mt-1">Primeira linha = cabeçalho. Campos opcionais podem ficar em branco.</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVFile} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Upload size={20} className="mx-auto mb-2" />
                Clique para selecionar o arquivo CSV
              </button>
              {csvRows.length > 0 && (
                <div className="px-4 py-3 bg-green-50 rounded-xl text-xs text-green-700 border border-green-100">
                  ✓ {csvRows.length} empresas encontradas — pronto para importar
                </div>
              )}
              {importResult && (
                <div className={`px-4 py-3 rounded-xl text-xs border ${importResult.err===0?'bg-green-50 text-green-700 border-green-100':'bg-amber-50 text-amber-700 border-amber-100'}`}>
                  ✓ {importResult.ok} importadas{importResult.err>0?` · ${importResult.err} com erro`:''}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => { setShowImport(false); setCsvRows([]); setImportResult(null) }} className="btn">Fechar</button>
                <button onClick={handleImport} disabled={csvRows.length===0||importing||!!importResult} className="btn-primary disabled:opacity-50">
                  {importing ? 'Importando...' : `Importar ${csvRows.length} empresas`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
