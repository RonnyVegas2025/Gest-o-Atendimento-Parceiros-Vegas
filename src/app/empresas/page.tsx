'use client'
import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function EmpresasPage() {
  const router = useRouter()
  const [empresas, setEmpresas]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [busca, setBusca]         = useState('')
  const [filtroProd, setFiltroProd] = useState('')
  const [filtroUF, setFiltroUF]   = useState('')
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const PER_PAGE = 20

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('empresas_conveniadas')
      .select('id, cnpj, nome_fantasia, razao_social, uf, municipio, id_grupo, dados_enriquecidos, ativo, empresas_produtos(produto_nome)', { count: 'exact' })
      .eq('ativo', true)
      .order('nome_fantasia')
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (busca.trim()) {
      // Busca por CNPJ, fantasia, razão social ou produto
      const b = busca.trim().replace(/\D/g, '') // tenta como CNPJ
      if (b.length >= 8) {
        query = query.ilike('cnpj', `%${b}%`)
      } else {
        query = query.or(
          `nome_fantasia.ilike.%${busca.trim()}%,razao_social.ilike.%${busca.trim()}%`
        )
      }
    }

    if (filtroUF) query = query.eq('uf', filtroUF)

    const { data, count, error } = await query
    if (!error) {
      // Filtra por produto se necessário (client-side pois é relação)
      let result = data ?? []
      if (filtroProd) {
        result = result.filter((e: any) =>
          e.empresas_produtos?.some((p: any) => p.produto_nome === filtroProd)
        )
      }
      setEmpresas(result)
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [busca, filtroUF, filtroProd, page])

  useEffect(() => { load() }, [load])

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

  return (
    <AppShell>
      <header style={{ background:'#fff', borderBottom:'1px solid #EAEAF0', padding:'14px 26px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:5 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:'#2C2A40' }}>Empresas Conveniadas</div>
          <div style={{ fontSize:11.5, color:'#AEADC0', marginTop:2 }}>{total} empresas cadastradas · Nex7 Participações</div>
        </div>
      </header>

      <div style={{ padding:'22px 26px' }}>
        {/* Filtros */}
        <div className="card" style={{ padding:'14px 18px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ flex:1, minWidth:240, position:'relative' }}>
            <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }} width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="#AEADC0" strokeWidth="1.4"/>
              <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#AEADC0" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              className="form-input"
              placeholder="Buscar por CNPJ, nome fantasia, razão social..."
              value={busca}
              onChange={e => { setBusca(e.target.value); setPage(0) }}
              style={{ paddingLeft:30 }}
            />
          </div>
          <select className="form-input" style={{ width:'auto' }} value={filtroProd} onChange={e => { setFiltroProd(e.target.value); setPage(0) }}>
            <option value="">Todos os produtos</option>
            {PRODUTOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="form-input" style={{ width:'auto' }} value={filtroUF} onChange={e => { setFiltroUF(e.target.value); setPage(0) }}>
            <option value="">Todos os estados</option>
            {UFS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <span style={{ fontSize:11.5, color:'#AEADC0', fontWeight:600, whiteSpace:'nowrap' }}>
            {empresas.length} resultados
          </span>
        </div>

        {/* Tabela */}
        <div className="card">
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#FAFAFA' }}>
                {['Empresa','CNPJ','ID Grupo','Localidade','Produtos','Dados','Ações'].map(h => (
                  <th key={h} style={{ fontSize:10.5, fontWeight:700, color:'#AEADC0', textAlign:'left', padding:'10px 16px', borderBottom:'1px solid #EAEAF0', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'#AEADC0' }}>Carregando...</td></tr>
              )}
              {!loading && empresas.length === 0 && (
                <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'#AEADC0', fontSize:13 }}>
                  Nenhuma empresa encontrada.
                </td></tr>
              )}
              {!loading && empresas.map((e: any) => {
                const produtos: string[] = [...new Set((e.empresas_produtos ?? []).map((p: any) => p.produto_nome))] as string[]
                return (
                  <tr key={e.id} style={{ borderBottom:'1px solid #F4F4F8', cursor:'pointer' }}
                    onMouseEnter={el => (el.currentTarget.style.background = '#FAFAFE')}
                    onMouseLeave={el => (el.currentTarget.style.background = '')}>
                    <td style={{ padding:'11px 16px' }}>
                      <div style={{ fontWeight:700, fontSize:12.5, color:'#2C2A40' }}>{e.nome_fantasia}</div>
                      {e.razao_social && <div style={{ fontSize:10.5, color:'#AEADC0', marginTop:1 }}>{e.razao_social}</div>}
                    </td>
                    <td style={{ padding:'11px 16px', fontSize:11.5, fontFamily:'monospace', color:'#7F77DD' }}>
                      {e.cnpj ? e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : <span style={{ color:'#AEADC0' }}>—</span>}
                    </td>
                    <td style={{ padding:'11px 16px' }}>
                      <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#F5F4FC', color:'#5B52C2' }}>
                        {e.id_grupo}
                      </span>
                    </td>
                    <td style={{ padding:'11px 16px', fontSize:11.5, color:'#7A798C' }}>
                      {e.municipio} · <strong>{e.uf}</strong>
                    </td>
                    <td style={{ padding:'11px 16px' }}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {produtos.map(p => {
                          const c = PROD_COLORS[p] ?? { bg:'#F1EFE8', color:'#5F5E5A' }
                          return (
                            <span key={p} style={{ display:'inline-block', padding:'1px 6px', borderRadius:20, fontSize:9.5, fontWeight:700, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>
                              {p}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding:'11px 16px' }}>
                      {e.dados_enriquecidos
                        ? <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' }}>✓ Completo</span>
                        : <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'#FAEEDA', color:'#854F0B' }}>Pendente</span>
                      }
                    </td>
                    <td style={{ padding:'11px 16px' }}>
                      <button
                        onClick={() => router.push(`/empresas/${e.id}`)}
                        style={{ width:26, height:26, borderRadius:7, border:'1px solid #EAEAF0', background:'#fff', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#AEADC0' }}
                        title="Ver detalhes"
                      >
                        <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="6.5" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Paginação */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderTop:'1px solid #EAEAF0' }}>
            <span style={{ fontSize:11.5, color:'#AEADC0', fontWeight:600 }}>
              Página {page + 1} · {total} empresas no total
            </span>
            <div style={{ display:'flex', gap:4 }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ width:28, height:28, borderRadius:7, border:'1px solid #EAEAF0', background: page===0 ? '#FAFAFA' : '#fff', cursor: page===0 ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: page===0 ? '#AEADC0' : '#7A798C' }}
              >‹</button>
              {Array.from({ length: Math.min(5, Math.ceil(total/PER_PAGE)) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  style={{ width:28, height:28, borderRadius:7, border:'1px solid #EAEAF0', background: page===i ? 'linear-gradient(135deg,#6B62D4,#B87070)' : '#fff', color: page===i ? '#fff' : '#7A798C', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'Nunito,sans-serif' }}>
                  {i+1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * PER_PAGE >= total}
                style={{ width:28, height:28, borderRadius:7, border:'1px solid #EAEAF0', background:'#fff', cursor:(page+1)*PER_PAGE>=total?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#7A798C' }}
              >›</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

