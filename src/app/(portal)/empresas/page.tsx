'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search } from 'lucide-react'

const PRODUTOS = ['Alimentação','Vegas Plus','Vegas Day','Aux. Combustível','Combustível Frota','Farmácia','Cartão Natal']
const UFS = ['PR','SP','RS','SC','MG','RJ','GO','DF','MS','MT','BA','RN','ES']

const PROD_COLORS: Record<string,{bg:string;color:string}> = {
  'Alimentação':       { bg:'#E1F5EE', color:'#0F6E56' },
  'Vegas Plus':        { bg:'#EEEDFE', color:'#5B52C2' },
  'Vegas Day':         { bg:'#E6F1FB', color:'#185FA5' },
  'Aux. Combustível':  { bg:'#FAEEDA', color:'#854F0B' },
  'Combustível Frota': { bg:'#FAECE7', color:'#993C1D' },
  'Farmácia':          { bg:'#FCE8F0', color:'#8C1D4E' },
  'Cartão Natal':      { bg:'#FEF3E2', color:'#7A4200' },
}

export default function EmpresasPage() {
  const supabase = createClient()
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [filtroProd, setFiltroProd] = useState('')
  const [filtroUF, setFiltroUF] = useState('')
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const PER_PAGE = 20

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
      } else {
        query = query.or(`nome_fantasia.ilike.%${busca.trim()}%,razao_social.ilike.%${busca.trim()}%`)
      }
    }
    if (filtroUF) query = query.eq('uf', filtroUF)

    const { data, count } = await query
    let result = data ?? []
    if (filtroProd) {
      result = result.filter((e: any) =>
        e.empresas_produtos?.some((p: any) => p.produto_nome === filtroProd)
      )
    }
    setEmpresas(result)
    setTotal(count ?? 0)
    setLoading(false)
  }, [busca, filtroUF, filtroProd, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Empresas Conveniadas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} empresas · Nex7 Participações</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="CNPJ, nome fantasia, razão social..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPage(0) }}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={filtroProd}
          onChange={e => { setFiltroProd(e.target.value); setPage(0) }}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
        >
          <option value="">Todos os produtos</option>
          {PRODUTOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filtroUF}
          onChange={e => { setFiltroUF(e.target.value); setPage(0) }}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
        >
          <option value="">Todos os estados</option>
          {UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{empresas.length} resultados</span>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-header grid" style={{ gridTemplateColumns:'1fr 140px 80px 140px 1fr 90px 60px' }}>
          <span>Empresa</span>
          <span>CNPJ</span>
          <span>Grupo</span>
          <span>Localidade</span>
          <span>Produtos</span>
          <span>Dados</span>
          <span></span>
        </div>

        {loading && (
          <div className="py-10 text-center text-sm text-gray-400">Carregando...</div>
        )}

        {!loading && empresas.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">Nenhuma empresa encontrada.</div>
        )}

        {!loading && empresas.map((e: any) => {
          const produtos: string[] = [...new Set((e.empresas_produtos ?? []).map((p: any) => p.produto_nome))] as string[]
          return (
            <div key={e.id} className="table-row grid hover:bg-blue-50/30" style={{ gridTemplateColumns:'1fr 140px 80px 140px 1fr 90px 60px' }}>
              <div>
                <div className="text-sm font-medium text-gray-900 truncate">{e.nome_fantasia}</div>
                {e.razao_social && <div className="text-xs text-gray-400 truncate">{e.razao_social}</div>}
              </div>
              <span className="font-mono text-xs text-indigo-600 self-center">
                {e.cnpj
                  ? e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                  : <span className="text-gray-300">—</span>}
              </span>
              <span className="self-center">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">
                  {e.id_grupo}
                </span>
              </span>
              <span className="text-xs text-gray-500 self-center">{e.municipio} · <strong>{e.uf}</strong></span>
              <div className="flex flex-wrap gap-1 self-center">
                {produtos.map(p => {
                  const c = PROD_COLORS[p] ?? { bg:'#F1EFE8', color:'#5F5E5A' }
                  return (
                    <span key={p} style={{ background:c.bg, color:c.color }}
                      className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">
                      {p}
                    </span>
                  )
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

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:border-indigo-300">‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-bold transition-colors ${page===i ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                  {i+1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page>=totalPages-1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-xs text-gray-500 disabled:opacity-40 hover:border-indigo-300">›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
