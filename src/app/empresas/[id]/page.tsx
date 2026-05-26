'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { createBrowserClient } from '@supabase/ssr'

export default function EmpresaDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const [empresa, setEmpresa]     = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [enriquecendo, setEnr]    = useState(false)
  const [msg, setMsg]             = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function load() {
    const { data } = await supabase
      .from('empresas_conveniadas')
      .select('*, empresas_produtos(*), grupos_economicos(parceiro, nome_grupo)')
      .eq('id', id as string)
      .single()
    setEmpresa(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Busca dados do CNPJ na API pública brasilapi.com.br
  async function enriquecerCNPJ() {
    if (!empresa?.cnpj) { setMsg('Esta empresa não tem CNPJ cadastrado.'); return }
    setEnr(true); setMsg('')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${empresa.cnpj}`)
      if (!res.ok) throw new Error('CNPJ não encontrado na Receita Federal')
      const d = await res.json()

      const updates = {
        razao_social:   d.razao_social ?? empresa.razao_social,
        endereco:       [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', '),
        bairro:         d.bairro ?? null,
        cep:            d.cep ?? null,
        municipio:      d.municipio ?? empresa.municipio,
        uf:             d.uf ?? empresa.uf,
        telefone:       d.ddd_telefone_1 ?? null,
        email:          d.email ?? null,
        cnae_principal: d.cnae_fiscal_descricao ?? null,
        situacao_cnpj:  d.descricao_situacao_cadastral ?? null,
        dados_enriquecidos: true,
        atualizado_em:  new Date().toISOString(),
      }

      const { error } = await supabase
        .from('empresas_conveniadas')
        .update(updates)
        .eq('id', id as string)

      if (error) throw new Error(error.message)
      setMsg('✓ Dados atualizados com sucesso!')
      load()
    } catch (err: any) {
      setMsg('Erro: ' + err.message)
    }
    setEnr(false)
  }

  if (loading) return (
    <AppShell>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#AEADC0' }}>Carregando...</div>
    </AppShell>
  )
  if (!empresa) return (
    <AppShell>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#AEADC0' }}>Empresa não encontrada.</div>
    </AppShell>
  )

  const produtos = empresa.empresas_produtos ?? []

  const PROD_COLORS: Record<string,{bg:string;color:string}> = {
    'Alimentação':       { bg:'#E1F5EE', color:'#0F6E56' },
    'Vegas Plus':        { bg:'#EEEDFE', color:'#5B52C2' },
    'Vegas Day':         { bg:'#E6F1FB', color:'#185FA5' },
    'Aux. Combustível':  { bg:'#FAEEDA', color:'#854F0B' },
    'Combustível Frota': { bg:'#FAECE7', color:'#993C1D' },
    'Farmácia':          { bg:'#FCE8F0', color:'#8C1D4E' },
    'Cartão Natal':      { bg:'#FEF3E2', color:'#7A4200' },
  }

  const cnpjFormatado = empresa.cnpj
    ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null

  return (
    <AppShell>
      <header style={{ background:'#fff', borderBottom:'1px solid #EAEAF0', padding:'14px 26px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => router.back()} style={{ width:30, height:30, borderRadius:9, border:'1px solid #EAEAF0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#AEADC0' }}>
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M8.5 2L4 6.5l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#2C2A40' }}>{empresa.nome_fantasia}</div>
            <div style={{ fontSize:11.5, color:'#AEADC0', marginTop:2 }}>
              {empresa.grupos_economicos?.parceiro} · Grupo {empresa.id_grupo}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {empresa.dados_enriquecidos
            ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' }}>✓ Dados completos</span>
            : <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'#FAEEDA', color:'#854F0B' }}>Dados incompletos</span>
          }
          {empresa.cnpj && (
            <button
              onClick={enriquecerCNPJ}
              disabled={enriquecendo}
              className="btn-primary"
              style={{ gap:6 }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3 3l1.5 1.5M9.5 9.5L11 11M3 11l1.5-1.5M9.5 4.5L11 3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {enriquecendo ? 'Consultando CNPJ...' : 'Atualizar via CNPJ'}
            </button>
          )}
        </div>
      </header>

      <div style={{ padding:'22px 26px' }}>
        {msg && (
          <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, background: msg.startsWith('✓') ? '#E1F5EE' : '#FCEBEB', color: msg.startsWith('✓') ? '#0F6E56' : '#A32D2D', fontSize:13, fontWeight:600 }}>
            {msg}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:18 }}>

          {/* Coluna principal */}
          <div>
            {/* Dados básicos */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #EAEAF0' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2C2A40' }}>Dados Cadastrais</div>
              </div>
              <div style={{ padding:18 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {[
                    { label:'CNPJ',           value: cnpjFormatado ?? '—', mono: true },
                    { label:'Razão Social',    value: empresa.razao_social ?? <span style={{ color:'#C97A7A', fontSize:11 }}>Não preenchido — clique em "Atualizar via CNPJ"</span> },
                    { label:'Nome Fantasia',   value: empresa.nome_fantasia },
                    { label:'ID Grupo',        value: empresa.id_grupo },
                    { label:'Parceiro',        value: empresa.parceiro },
                    { label:'Município / UF',  value: `${empresa.municipio} · ${empresa.uf}` },
                    { label:'Situação CNPJ',   value: empresa.situacao_cnpj ?? '—' },
                    { label:'CNAE Principal',  value: empresa.cnae_principal ?? '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize:11, color:'#AEADC0', fontWeight:600, marginBottom:3 }}>{item.label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#2C2A40', fontFamily: (item as any).mono ? 'monospace' : 'inherit' }}>{item.value as any}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #EAEAF0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2C2A40' }}>Endereço</div>
                {!empresa.endereco && empresa.cnpj && (
                  <span style={{ fontSize:11, color:'#C97A7A' }}>Clique em "Atualizar via CNPJ" para preencher</span>
                )}
              </div>
              <div style={{ padding:18 }}>
                {empresa.endereco ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    {[
                      { label:'Logradouro', value: empresa.endereco },
                      { label:'Bairro',     value: empresa.bairro ?? '—' },
                      { label:'CEP',        value: empresa.cep ?? '—' },
                      { label:'Cidade/UF',  value: `${empresa.municipio} · ${empresa.uf}` },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize:11, color:'#AEADC0', fontWeight:600, marginBottom:3 }}>{item.label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#2C2A40' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign:'center', color:'#AEADC0', fontSize:13, padding:'8px 0' }}>
                    Endereço não disponível ainda.
                  </div>
                )}
              </div>
            </div>

            {/* Contato */}
            {(empresa.telefone || empresa.email) && (
              <div className="card">
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #EAEAF0' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#2C2A40' }}>Contato</div>
                </div>
                <div style={{ padding:18, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {empresa.telefone && (
                    <div>
                      <div style={{ fontSize:11, color:'#AEADC0', fontWeight:600, marginBottom:3 }}>Telefone</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#2C2A40' }}>{empresa.telefone}</div>
                    </div>
                  )}
                  {empresa.email && (
                    <div>
                      <div style={{ fontSize:11, color:'#AEADC0', fontWeight:600, marginBottom:3 }}>E-mail</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#7F77DD' }}>{empresa.email}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Coluna lateral */}
          <div>
            {/* Produtos contratados */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #EAEAF0' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2C2A40' }}>Produtos Contratados</div>
                <div style={{ fontSize:11.5, color:'#AEADC0', marginTop:2 }}>{produtos.length} produto{produtos.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ padding:14 }}>
                {produtos.length === 0 && (
                  <div style={{ textAlign:'center', color:'#AEADC0', fontSize:12, padding:8 }}>Nenhum produto.</div>
                )}
                {produtos.map((p: any) => {
                  const c = PROD_COLORS[p.produto_nome] ?? { bg:'#F1EFE8', color:'#5F5E5A' }
                  return (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #F4F4F8' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                        <span style={{ fontSize:12.5, fontWeight:700, color:'#2C2A40' }}>{p.produto_nome}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:20, fontSize:9.5, fontWeight:700, background:c.bg, color:c.color }}>
                          ID {p.produto_id}
                        </span>
                        {p.data_cadastro && (
                          <div style={{ fontSize:10, color:'#AEADC0', marginTop:2 }}>
                            {new Date(p.data_cadastro).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grupo econômico */}
            <div className="card">
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #EAEAF0' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2C2A40' }}>Grupo Econômico</div>
              </div>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid #F4F4F8' }}>
                  <span style={{ fontSize:11.5, color:'#AEADC0', fontWeight:600 }}>ID Grupo</span>
                  <span style={{ fontSize:12.5, fontWeight:800, color:'#5B52C2' }}>{empresa.id_grupo}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid #F4F4F8' }}>
                  <span style={{ fontSize:11.5, color:'#AEADC0', fontWeight:600 }}>Parceiro</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#2C2A40' }}>{empresa.parceiro}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0' }}>
                  <span style={{ fontSize:11.5, color:'#AEADC0', fontWeight:600 }}>Cadastrado em</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#2C2A40' }}>
                    {empresa.data_cadastro ? new Date(empresa.data_cadastro).toLocaleDateString('pt-BR') : '—'}
                  </span>
                </div>
                <button
                  onClick={() => router.push(`/empresas?busca=${empresa.id_grupo}`)}
                  style={{ width:'100%', marginTop:12, padding:'8px', borderRadius:10, border:'1.5px solid #EEEDFE', background:'#EEEDFE', color:'#5B52C2', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}
                >
                  Ver todas empresas do grupo →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

