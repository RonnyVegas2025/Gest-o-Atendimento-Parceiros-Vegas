'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, ArrowLeft } from 'lucide-react'

const PROD_COLORS: Record<string,{bg:string;color:string}> = {
  'Alimentação':       { bg:'#E1F5EE', color:'#0F6E56' },
  'Vegas Plus':        { bg:'#EEEDFE', color:'#5B52C2' },
  'Vegas Day':         { bg:'#E6F1FB', color:'#185FA5' },
  'Aux. Combustível':  { bg:'#FAEEDA', color:'#854F0B' },
  'Combustível Frota': { bg:'#FAECE7', color:'#993C1D' },
  'Farmácia':          { bg:'#FCE8F0', color:'#8C1D4E' },
  'Cartão Natal':      { bg:'#FEF3E2', color:'#7A4200' },
}

export default function EmpresaDetalhePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [empresa, setEmpresa]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [enriquecendo, setEnr]  = useState(false)
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null)

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

  async function enriquecerCNPJ() {
    if (!empresa?.cnpj) { setMsg({ text:'Empresa sem CNPJ cadastrado.', ok:false }); return }
    setEnr(true); setMsg(null)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${empresa.cnpj}`)
      if (!res.ok) throw new Error('CNPJ não encontrado na Receita Federal')
      const d = await res.json()

      await supabase.from('empresas_conveniadas').update({
        razao_social:   d.razao_social ?? empresa.razao_social,
        endereco:       [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', ') || null,
        bairro:         d.bairro || null,
        cep:            d.cep || null,
        municipio:      d.municipio ?? empresa.municipio,
        uf:             d.uf ?? empresa.uf,
        telefone:       d.ddd_telefone_1 || null,
        email:          d.email || null,
        cnae_principal: d.cnae_fiscal_descricao || null,
        situacao_cnpj:  d.descricao_situacao_cadastral || null,
        dados_enriquecidos: true,
      }).eq('id', id as string)

      setMsg({ text:'Dados atualizados com sucesso!', ok:true })
      load()
    } catch (err: any) {
      setMsg({ text: err.message, ok:false })
    }
    setEnr(false)
  }

  if (loading) return (
    <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
  )
  if (!empresa) return (
    <div className="p-6 text-center text-sm text-gray-400">Empresa não encontrada.</div>
  )

  const produtos = empresa.empresas_produtos ?? []
  const cnpjFmt  = empresa.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{empresa.nome_fantasia}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {empresa.grupos_economicos?.parceiro} · Grupo {empresa.id_grupo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {empresa.dados_enriquecidos
            ? <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">✓ Dados completos</span>
            : <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">Dados incompletos</span>
          }
          {empresa.cnpj && (
            <button onClick={enriquecerCNPJ} disabled={enriquecendo}
              className="btn-primary flex items-center gap-1.5 text-xs disabled:opacity-60">
              <RefreshCw size={13} className={enriquecendo ? 'animate-spin' : ''} />
              {enriquecendo ? 'Consultando...' : 'Atualizar via CNPJ'}
            </button>
          )}
        </div>
      </div>

      {/* Mensagem feedback */}
      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.ok ? '✓ ' : '✕ '}{msg.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">

        {/* Dados Cadastrais */}
        <div className="col-span-2 space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Dados Cadastrais</span></div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {[
                { label:'CNPJ',          value: cnpjFmt ?? '—',  mono:true },
                { label:'Razão Social',  value: empresa.razao_social
                    ?? <span className="text-amber-500 text-xs">Não preenchido — clique em "Atualizar via CNPJ"</span> },
                { label:'Nome Fantasia', value: empresa.nome_fantasia },
                { label:'ID Grupo',      value: empresa.id_grupo },
                { label:'Parceiro',      value: empresa.parceiro },
                { label:'Município/UF',  value: `${empresa.municipio} · ${empresa.uf}` },
                { label:'Situação CNPJ', value: empresa.situacao_cnpj ?? '—' },
                { label:'CNAE',          value: empresa.cnae_principal ?? '—' },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{item.label}</div>
                  <div className={`text-sm font-semibold text-gray-800 ${(item as any).mono ? 'font-mono' : ''}`}>
                    {item.value as any}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Endereço */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Endereço</span>
              {!empresa.endereco && empresa.cnpj && (
                <span className="text-xs text-amber-500">Clique em "Atualizar via CNPJ" para preencher</span>
              )}
            </div>
            <div className="p-4">
              {empresa.endereco ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label:'Logradouro', value: empresa.endereco },
                    { label:'Bairro',     value: empresa.bairro ?? '—' },
                    { label:'CEP',        value: empresa.cep ?? '—' },
                    { label:'Cidade/UF',  value: `${empresa.municipio} · ${empresa.uf}` },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{item.label}</div>
                      <div className="text-sm font-semibold text-gray-800">{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-gray-400">
                  Endereço não disponível. Use "Atualizar via CNPJ" para buscar.
                </div>
              )}
            </div>
          </div>

          {/* Contato */}
          {(empresa.telefone || empresa.email) && (
            <div className="card">
              <div className="card-header"><span className="card-title">Contato</span></div>
              <div className="p-4 grid grid-cols-2 gap-4">
                {empresa.telefone && (
                  <div>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Telefone</div>
                    <div className="text-sm font-semibold text-gray-800">{empresa.telefone}</div>
                  </div>
                )}
                {empresa.email && (
                  <div>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">E-mail</div>
                    <div className="text-sm font-semibold text-indigo-600">{empresa.email}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Produtos */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Produtos Contratados</span>
              <span className="text-xs text-gray-400">{produtos.length} produto{produtos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {produtos.length === 0 && (
                <div className="px-4 py-3 text-xs text-center text-gray-400">Nenhum produto.</div>
              )}
              {produtos.map((p: any) => {
                const c = PROD_COLORS[p.produto_nome] ?? { bg:'#F1EFE8', color:'#5F5E5A' }
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background:c.color }}/>
                      <span className="text-sm font-semibold text-gray-800">{p.produto_nome}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:c.bg, color:c.color }}>
                      ID {p.produto_id}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grupo econômico */}
          <div className="card">
            <div className="card-header"><span className="card-title">Grupo Econômico</span></div>
            <div className="divide-y divide-gray-50">
              {[
                { label:'ID Grupo', value: empresa.id_grupo, bold:true },
                { label:'Parceiro', value: empresa.parceiro },
                { label:'Cadastrado em', value: empresa.data_cadastro ? new Date(empresa.data_cadastro).toLocaleDateString('pt-BR') : '—' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-400">{item.label}</span>
                  <span className={`text-xs font-semibold ${(item as any).bold ? 'text-indigo-600' : 'text-gray-700'}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="px-4 pb-3 pt-1">
              <button
                onClick={() => router.push(`/empresas?id_grupo=${empresa.id_grupo}`)}
                className="w-full py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                Ver todas empresas do grupo →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
