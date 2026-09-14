'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Upload, History, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SITUACAO_INADIMPLENCIA, diasEmAberto, fmtBRL, fmtDateBR, normKey,
} from '@/lib/inadimplencia'

/*
 * LISTA DE INADIMPLÊNCIA (uso interno). Colunas: razão social, parceiro, ID,
 * vencimento, dias em aberto (CALCULADO a partir do vencimento), valor, situação
 * e status de bloqueio. Filtros por parceiro, situação, período de vencimento,
 * faixa de dias em aberto e busca (razão social / ID). Totalizadores de "em
 * aberto" no topo. Linha abre o detalhe da empresa vinculada, quando houver.
 */

const FAIXAS_DIAS = [
  { value: '',       label: 'Qualquer atraso' },
  { value: '1-30',   label: '1 a 30 dias' },
  { value: '31-60',  label: '31 a 60 dias' },
  { value: '61-90',  label: '61 a 90 dias' },
  { value: '90+',    label: 'Mais de 90 dias' },
]

function dentroDaFaixa(dias: number | null, faixa: string): boolean {
  if (!faixa) return true
  if (dias === null) return false
  if (faixa === '90+') return dias > 90
  const [a, b] = faixa.split('-').map(Number)
  return dias >= a && dias <= b
}

const COLS = '1fr 130px 90px 100px 110px 120px 110px 150px'

export default function InadimplenciaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [parceiros, setParceiros] = useState<string[]>([])

  const [fParceiro, setFParceiro] = useState('')
  const [fSituacao, setFSituacao] = useState('em_aberto')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [fFaixa, setFFaixa] = useState('')
  const [busca, setBusca] = useState('')

  // Opções de parceiro (distintos)
  useEffect(() => {
    supabase.from('inadimplencias').select('parceiro_planilha').limit(20000).then(({ data }) => {
      const set = new Set<string>()
      for (const r of (data as any[]) ?? []) if (r.parceiro_planilha) set.add(r.parceiro_planilha)
      setParceiros(Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR')))
    })
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase.from('inadimplencias').select('*').order('vencimento', { ascending: true }).limit(2000)
      if (fParceiro) q = q.eq('parceiro_planilha', fParceiro)
      if (fSituacao) q = q.eq('situacao', fSituacao)
      if (fDe) q = q.gte('vencimento', fDe)
      if (fAte) q = q.lte('vencimento', fAte)
      const { data } = await q
      setRows((data as any[]) ?? [])
      setLoading(false)
    }
    load()
  }, [fParceiro, fSituacao, fDe, fAte])

  const filtered = useMemo(() => {
    const q = normKey(busca)
    return rows.filter(r => {
      const dias = r.situacao === 'em_aberto' ? diasEmAberto(r.vencimento) : null
      if (!dentroDaFaixa(dias, fFaixa)) return false
      if (q) {
        const hay = normKey(r.razao_social_planilha) + ' ' + normKey(r.id_produto_raw)
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, busca, fFaixa])

  const totais = useMemo(() => {
    const abertos = filtered.filter(r => r.situacao === 'em_aberto')
    return { qtd: abertos.length, soma: abertos.reduce((s, r) => s + (Number(r.valor) || 0), 0) }
  }, [filtered])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Inadimplência</h1>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length} registro(s) · controle interno por importação de planilha</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inadimplencia/importacoes" className="btn"><History size={15} /> Importações</Link>
          <Link href="/inadimplencia/importar" className="btn-primary"><Upload size={15} /> Importar planilha</Link>
        </div>
      </div>

      {/* Totalizadores (em aberto) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><div className="card-body">
          <div className="text-xs text-gray-400">Títulos em aberto</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{totais.qtd}</div>
        </div></div>
        <div className="card md:col-span-2"><div className="card-body">
          <div className="text-xs text-gray-400">Valor total em aberto</div>
          <div className="text-2xl font-semibold text-red-700 mt-1">{fmtBRL(totais.soma)}</div>
        </div></div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="select w-52" value={fParceiro} onChange={e => setFParceiro(e.target.value)}>
          <option value="">Todos os parceiros</option>
          {parceiros.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="select w-40" value={fSituacao} onChange={e => setFSituacao(e.target.value)}>
          <option value="">Todas as situações</option>
          {Object.entries(SITUACAO_INADIMPLENCIA).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <select className="select w-44" value={fFaixa} onChange={e => setFFaixa(e.target.value)}>
          {FAIXAS_DIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          Venc. de <input type="date" className="input w-40" value={fDe} onChange={e => setFDe(e.target.value)} />
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          até <input type="date" className="input w-40" value={fAte} onChange={e => setFAte(e.target.value)} />
        </label>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Buscar por razão social ou ID..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="table-header grid text-xs" style={{ gridTemplateColumns: COLS }}>
          <span>Razão social</span><span>Parceiro</span><span>ID</span><span>Vencimento</span>
          <span>Dias em aberto</span><span>Valor</span><span>Situação</span><span>Status bloqueio</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum registro encontrado.</div>
        ) : filtered.slice(0, 500).map(r => {
          const sit = SITUACAO_INADIMPLENCIA[r.situacao] ?? { label: r.situacao, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
          const dias = r.situacao === 'em_aberto' ? diasEmAberto(r.vencimento) : null
          const clickable = !!r.empresa_id
          return (
            <div key={r.id}
              onClick={() => clickable && router.push(`/empresas/${r.empresa_id}`)}
              className={cn('table-row grid', clickable && 'cursor-pointer hover:bg-blue-50/30')}
              style={{ gridTemplateColumns: COLS }}>
              <div className="self-center min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{r.razao_social_planilha || '—'}</div>
                {!r.empresa_id && <div className="text-xs text-amber-600">sem empresa vinculada</div>}
              </div>
              <span className="text-xs text-gray-500 self-center truncate">{r.parceiro_planilha || '—'}</span>
              <span className="font-mono text-xs text-gray-600 self-center">{r.id_produto_raw || '—'}</span>
              <span className="text-xs text-gray-500 self-center">{fmtDateBR(r.vencimento)}</span>
              <span className="text-xs self-center">
                {dias === null ? <span className="text-gray-300">—</span>
                  : <span className={cn(dias > 90 ? 'text-red-700 font-medium' : dias > 30 ? 'text-amber-700' : 'text-gray-600')}>{dias} dia{dias === 1 ? '' : 's'}</span>}
              </span>
              <span className="text-sm text-gray-800 self-center">{fmtBRL(r.valor)}</span>
              <span className="self-center"><span className={cn('badge', sit.badge)}>{sit.label}</span></span>
              <span className="text-xs text-gray-500 self-center truncate">{r.status_bloqueio || '—'}</span>
            </div>
          )
        })}
        {!loading && filtered.length > 500 && (
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Mostrando os primeiros 500 de {filtered.length} registros. Refine os filtros.</div>
        )}
      </div>
    </div>
  )
}
