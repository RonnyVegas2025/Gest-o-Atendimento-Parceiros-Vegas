'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, RotateCcw, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtMes, fmtDateBR, fmtBRL } from '@/lib/inadimplencia'
import { formatDate } from '@/lib/utils'

/*
 * PENDÊNCIAS DE UMA IMPORTAÇÃO (uso interno). Lista as linhas que não vincularam
 * automaticamente com a empresa e permite marcar cada uma como resolvida (ou
 * reabrir). Não altera a inadimplência em si — é um controle de tratativa.
 */

const COLS = '100px 1fr 100px 120px 150px 130px'

export default function PendenciasImportacaoPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [imp, setImp] = useState<any>(null)
  const [pend, setPend] = useState<any[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [mostrarResolvidas, setMostrarResolvidas] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data: impData }, { data: pendData }, { data: users }] = await Promise.all([
      supabase.from('inadimplencia_importacoes').select('*').eq('id', id).maybeSingle(),
      supabase.from('inadimplencia_pendencias').select('*').eq('importacao_id', id).order('criado_em', { ascending: true }),
      supabase.from('users_profile').select('id, full_name'),
    ])
    setImp(impData)
    setPend((pendData as any[]) ?? [])
    setUsersMap(Object.fromEntries(((users as any[]) ?? []).map(u => [u.id, u.full_name])))
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  async function toggle(p: any) {
    await supabase.from('inadimplencia_pendencias').update({ resolvida: !p.resolvida }).eq('id', p.id)
    setPend(prev => prev.map(x => x.id === p.id ? { ...x, resolvida: !x.resolvida } : x))
  }

  const visiveis = mostrarResolvidas ? pend : pend.filter(p => !p.resolvida)
  const abertas = pend.filter(p => !p.resolvida).length

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/inadimplencia/importacoes" className="btn btn-sm"><ArrowLeft size={14} /></Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Pendências da importação</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {imp ? <>{fmtMes(imp.mes_referencia)} · {formatDate(imp.importado_em)}</> : 'Importação não encontrada'}
          </p>
        </div>
      </div>

      {imp && (
        <div className="card"><div className="card-body flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-sm text-gray-700 flex items-center gap-1.5"><FileSpreadsheet size={14} className="text-gray-400" />{imp.arquivo_nome || '—'}</span>
          <span className="text-xs text-gray-500">Linhas: <b className="text-gray-800">{imp.total_linhas ?? 0}</b></span>
          <span className="text-xs text-gray-500">Vinculadas: <b className="text-green-700">{imp.total_vinculadas ?? 0}</b></span>
          <span className="text-xs text-gray-500">Pendentes: <b className="text-amber-700">{imp.total_pendentes ?? 0}</b></span>
          <span className="text-xs text-gray-500">Importado por: <b className="text-gray-800">{usersMap[imp.importado_por] ?? '—'}</b></span>
        </div></div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{abertas} pendência(s) em aberto de {pend.length} no total</p>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={mostrarResolvidas} onChange={e => setMostrarResolvidas(e.target.checked)} />
          Mostrar resolvidas
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="table-header grid text-xs" style={{ gridTemplateColumns: COLS }}>
          <span>ID</span><span>Razão social</span><span>Venc.</span><span>Valor</span><span>Motivo</span><span>Ação</span>
        </div>

        {visiveis.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {pend.length === 0 ? 'Nenhuma pendência nesta importação.' : 'Nenhuma pendência em aberto.'}
          </div>
        ) : visiveis.map(p => (
          <div key={p.id} className={cn('table-row grid', p.resolvida && 'opacity-60')} style={{ gridTemplateColumns: COLS }}>
            <span className="font-mono text-xs text-gray-600 self-center">{p.id_produto_raw || '—'}</span>
            <span className="text-sm text-gray-800 self-center truncate">{p.razao_social_planilha || '—'}</span>
            <span className="text-xs text-gray-500 self-center">{fmtDateBR(p.vencimento)}</span>
            <span className="text-sm text-gray-700 self-center">{fmtBRL(p.valor)}</span>
            <span className="self-center"><span className="badge bg-amber-50 text-amber-700 border border-amber-200">{p.motivo}</span></span>
            <span className="self-center">
              {p.resolvida ? (
                <button onClick={() => toggle(p)} className="btn btn-sm"><RotateCcw size={13} /> Reabrir</button>
              ) : (
                <button onClick={() => toggle(p)} className="btn btn-sm"><Check size={13} /> Resolver</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
