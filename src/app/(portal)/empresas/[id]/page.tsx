'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Pencil, Check, X, RefreshCw } from 'lucide-react'

const PROD_COLORS: Record<string,{bg:string;color:string}> = {
  'Alimentação':       { bg:'#E1F5EE', color:'#0F6E56' },
  'Vegas Plus':        { bg:'#EEEDFE', color:'#5B52C2' },
  'Vegas Day':         { bg:'#E6F1FB', color:'#185FA5' },
  'Aux. Combustível':  { bg:'#FAEEDA', color:'#854F0B' },
  'Combustível Frota': { bg:'#FAECE7', color:'#993C1D' },
  'Farmácia':          { bg:'#FCE8F0', color:'#8C1D4E' },
  'Cartão Natal':      { bg:'#FEF3E2', color:'#7A4200' },
}

function EditableField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  function save() { onSave(val); setEditing(false) }
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
            value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus />
          <button onClick={save} className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={13} /></button>
          <button onClick={() => setEditing(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <div className={`text-sm font-semibold ${value ? 'text-gray-800' : 'text-amber-500'}`}>
            {value || 'Não preenchido — clique para editar'}
          </div>
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
            <Pencil size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

function EditableSelect({ label, value, options, onSave }: {
  label: string; value: string | null;
  options: {value:string;label:string}[];
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  function save() { onSave(val); setEditing(false) }
  const displayLabel = options.find(o => o.value === val)?.label ?? val ?? ''
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <select className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
            value={val} onChange={e => setVal(e.target.value)} autoFocus>
            <option value="">Selecione...</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={save} className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={13} /></button>
          <button onClick={() => setEditing(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <div className={`text-sm font-semibold ${displayLabel ? 'text-gray-800' : 'text-amber-500'}`}>
            {displayLabel || 'Não preenchido — clique para editar'}
          </div>
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
            <Pencil size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function EmpresaDetalhePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [empresa, setEmpresa] = useState<any>(null)
  const [parceiros, setParceiros] = useState<{id:string;name:string}[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null)
  const [loadingCnpj, setLoadingCnpj] = useState(false)

  async function load() {
    const [{ data }, { data: parts }] = await Promise.all([
      supabase.from('empresas_conveniadas')
        .select('*, empresas_produtos(*), grupos_economicos(parceiro, nome_grupo)')
        .eq('id', id as string).single(),
      supabase.from('partners').select('id, name').order('name'),
    ])
    setEmpresa(data)
    setParceiros((parts as any[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveField(field: string, value: string) {
    const { error } = await supabase.from('empresas_conveniadas')
      .update({ [field]: value || null }).eq('id', id as string)
    if (error) {
      setMsg({ text: 'Erro ao salvar: ' + error.message, ok: false })
    } else {
      setMsg({ text: '✓ Salvo com sucesso!', ok: true })
      setEmpresa((prev: any) => ({ ...prev, [field]: value || null }))
      setTimeout(() => setMsg(null), 3000)
    }
  }

  // ✅ Função que consulta a API do CNPJ e atualiza os campos vazios
  async function atualizarViaCnpj() {
    if (!empresa?.cnpj) return
    setLoadingCnpj(true)
    setMsg(null)

    try {
      const cnpjLimpo = empresa.cnpj.replace(/\D/g, '')
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)

      if (!res.ok) {
        setMsg({ text: 'CNPJ não encontrado na Receita Federal.', ok: false })
        setLoadingCnpj(false)
        return
      }

      const data = await res.json()

      // Monta apenas os campos que estão vazios no banco
      const updates: Record<string, string> = {}

      if (!empresa.razao_social && data.razao_social)
        updates.razao_social = data.razao_social

      if (!empresa.situacao_cnpj && data.descricao_situacao_cadastral)
        updates.situacao_cnpj = data.descricao_situacao_cadastral

      if (!empresa.cnae_principal && data.cnae_fiscal_descricao)
        updates.cnae_principal = `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`

      if (!empresa.endereco && data.logradouro)
        updates.endereco = `${data.logradouro}${data.numero ? ', ' + data.numero : ''}${data.complemento ? ' - ' + data.complemento : ''}`

      if (!empresa.bairro && data.bairro)
        updates.bairro = data.bairro

      if (!empresa.cep && data.cep)
        updates.cep = data.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')

      if (!empresa.municipio && data.municipio)
        updates.municipio = data.municipio

      if (!empresa.uf && data.uf)
        updates.uf = data.uf

      if (!empresa.telefone && data.ddd_telefone_1)
        updates.telefone = data.ddd_telefone_1.replace(/\D/g, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')

      if (Object.keys(updates).length === 0) {
        setMsg({ text: 'Todos os campos já estão preenchidos. Nada foi alterado.', ok: true })
        setLoadingCnpj(false)
        return
      }

      // Salva no banco de uma vez
      const { error } = await supabase.from('empresas_conveniadas')
        .update(updates).eq('id', id as string)

      if (error) {
        setMsg({ text: 'Erro ao salvar dados: ' + error.message, ok: false })
      } else {
        setEmpresa((prev: any) => ({ ...prev, ...updates }))
        const qtd = Object.keys(updates).length
        setMsg({ text: `✓ ${qtd} campo${qtd > 1 ? 's' : ''} atualizado${qtd > 1 ? 's' : ''} com sucesso via CNPJ!`, ok: true })
        setTimeout(() => setMsg(null), 4000)
      }
    } catch (e) {
      setMsg({ text: 'Erro ao consultar CNPJ. Tente novamente.', ok: false })
    }

    setLoadingCnpj(false)
  }

  if (loading) return <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
  if (!empresa) return <div className="p-6 text-center text-sm text-gray-400">Empresa não encontrada.</div>

  const produtos = empresa.empresas_produtos ?? []
  const cnpjFmt = empresa.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  const parceiroOptions = parceiros.map(p => ({ value: p.name, label: p.name }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{empresa.nome_fantasia}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{empresa.parceiro} · Grupo {empresa.id_grupo}</p>
          </div>
        </div>
        <div>
          {empresa.razao_social
            ? <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">✓ Dados completos</span>
            : <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">Dados incompletos</span>}
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">

          <div className="card">
            <div className="card-header">
              <span className="card-title">Dados Cadastrais</span>
              <span className="text-xs text-gray-400">Passe o mouse sobre o campo para editar</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">

              {/* CNPJ + botão atualizar */}
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">CNPJ</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold font-mono text-gray-800">{cnpjFmt ?? '—'}</div>
                  {empresa.cnpj && (
                    <button
                      onClick={atualizarViaCnpj}
                      disabled={loadingCnpj}
                      title="Consultar Receita Federal e preencher campos vazios"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={11} className={loadingCnpj ? 'animate-spin' : ''} />
                      {loadingCnpj ? 'Consultando...' : 'Atualizar via CNPJ'}
                    </button>
                  )}
                </div>
              </div>

              <EditableField label="Razão Social" value={empresa.razao_social} onSave={v => saveField('razao_social', v)} />
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Nome Fantasia</div>
                <div className="text-sm font-semibold text-gray-800">{empresa.nome_fantasia}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">ID Grupo</div>
                <div className="text-sm font-semibold text-gray-800">{empresa.id_grupo ?? '—'}</div>
              </div>
              <EditableSelect label="Parceiro" value={empresa.parceiro} options={parceiroOptions} onSave={v => saveField('parceiro', v)} />
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Município/UF</div>
                <div className="text-sm font-semibold text-gray-800">{empresa.municipio} · {empresa.uf}</div>
              </div>
              <EditableField label="Situação CNPJ" value={empresa.situacao_cnpj} onSave={v => saveField('situacao_cnpj', v)} />
              <EditableField label="CNAE" value={empresa.cnae_principal} onSave={v => saveField('cnae_principal', v)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Endereço</span>
              <span className="text-xs text-gray-400">Passe o mouse sobre o campo para editar</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <EditableField label="Logradouro" value={empresa.endereco} onSave={v => saveField('endereco', v)} />
              <EditableField label="Bairro" value={empresa.bairro} onSave={v => saveField('bairro', v)} />
              <EditableField label="CEP" value={empresa.cep} onSave={v => saveField('cep', v)} />
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Cidade/UF</div>
                <div className="text-sm font-semibold text-gray-800">{empresa.municipio} · {empresa.uf}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Contato Geral</span>
              <span className="text-xs text-gray-400">Passe o mouse sobre o campo para editar</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <EditableField label="Telefone" value={empresa.telefone} onSave={v => saveField('telefone', v)} />
              <EditableField label="E-mail" value={empresa.email} onSave={v => saveField('email', v)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Contato RH</span>
              <span className="text-xs text-gray-400">Passe o mouse sobre o campo para editar</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4">
              <EditableField label="Nome" value={empresa.contato_rh_nome} onSave={v => saveField('contato_rh_nome', v)} />
              <EditableField label="Telefone" value={empresa.contato_rh_telefone} onSave={v => saveField('contato_rh_telefone', v)} />
              <EditableField label="E-mail" value={empresa.contato_rh_email} onSave={v => saveField('contato_rh_email', v)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Contato Financeiro</span>
              <span className="text-xs text-gray-400">Passe o mouse sobre o campo para editar</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4">
              <EditableField label="Nome" value={empresa.contato_fin_nome} onSave={v => saveField('contato_fin_nome', v)} />
              <EditableField label="Telefone" value={empresa.contato_fin_telefone} onSave={v => saveField('contato_fin_telefone', v)} />
              <EditableField label="E-mail" value={empresa.contato_fin_email} onSave={v => saveField('contato_fin_email', v)} />
            </div>
          </div>

        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Produtos Contratados</span>
              <span className="text-xs text-gray-400">{produtos.length} produto{produtos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {produtos.length === 0 && <div className="px-4 py-3 text-xs text-center text-gray-400">Nenhum produto.</div>}
              {produtos.map((p: any) => {
                const c = PROD_COLORS[p.produto_nome] ?? { bg:'#F1EFE8', color:'#5F5E5A' }
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background:c.color }}/>
                      <span className="text-sm font-semibold text-gray-800">{p.produto_nome}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:c.bg, color:c.color }}>
                      ID {p.produto_id ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Grupo Econômico</span></div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">ID Grupo</div>
                <div className="text-xs font-bold text-indigo-600">{empresa.id_grupo ?? '—'}</div>
              </div>
              <EditableSelect label="Parceiro" value={empresa.parceiro} options={parceiroOptions} onSave={v => saveField('parceiro', v)} />
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Cadastrado em</div>
                <div className="text-xs font-semibold text-gray-700">
                  {empresa.data_cadastro ? new Date(empresa.data_cadastro).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
            </div>
            <div className="px-4 pb-3">
              <button onClick={() => router.push(`/empresas?busca=${empresa.id_grupo}`)}
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
