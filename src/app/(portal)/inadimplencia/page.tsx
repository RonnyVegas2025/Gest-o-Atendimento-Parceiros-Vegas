'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Upload, History, Search, Eye, X, ExternalLink, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SITUACAO_INADIMPLENCIA, MOTIVO_PENDENCIA, diasEmAberto, fmtBRL, fmtDateBR, fmtMes, normKey,
} from '@/lib/inadimplencia'

/*
 * LISTA DE INADIMPLÊNCIA (uso interno). Colunas: razão social, parceiro, ID,
 * vencimento, dias em aberto (CALCULADO a partir do vencimento), valor, situação
 * e status de bloqueio. Filtros por parceiro, situação, período de vencimento,
 * faixa de dias em aberto e busca (razão social / ID). Totalizadores de "em
 * aberto" no topo. Linha abre o detalhe da empresa vinculada, quando houver.
 * Botão de ação por linha abre um drawer somente leitura com TODOS os campos.
 */

/*
 * Controla se o bloco "Informações internas" (Bloco 2) é exibido. Hoje esta
 * tela é só para o time interno, então fica sempre visível. Quando existir
 * controle de acesso por perfil, basta gatear esta única condição (ex.:
 * `perfil !== 'parceiro'`) para ocultar TODOS os dados internos de uma vez —
 * o parceiro externo não pode ver o conteúdo do Bloco 2.
 */
const MOSTRAR_INFO_INTERNA = true

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

const COLS = '1fr 120px 80px 95px 105px 110px 100px 120px 44px'

export default function InadimplenciaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [parceiros, setParceiros] = useState<string[]>([])
  const [selected, setSelected] = useState<any | null>(null)

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
          <span>Dias em aberto</span><span>Valor</span><span>Situação</span><span>Status bloqueio</span><span className="sr-only">Detalhe</span>
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
              <span className="self-center flex justify-center" onClick={e => e.stopPropagation()}>
                <button type="button" aria-label="Ver detalhe completo do título"
                  onClick={() => setSelected(r)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[color:var(--vg-brand-500)] hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1">
                  <Eye size={15} />
                </button>
              </span>
            </div>
          )
        })}
        {!loading && filtered.length > 500 && (
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Mostrando os primeiros 500 de {filtered.length} registros. Refine os filtros.</div>
        )}
      </div>

      {selected && <DetalheDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ————————————————————————————————————————————————————————————————
// Drawer de detalhe (somente leitura): Esc e clique fora fecham; foco visível.
// ————————————————————————————————————————————————————————————————
function DetalheDrawer({ row, onClose }: { row: any; onClose: () => void }) {
  const supabase = createClient()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [empresaNome, setEmpresaNome] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)

  // Esc fecha
  const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onKey])

  // Resolve o vínculo: nome da empresa (quando houver) ou o motivo da ausência.
  useEffect(() => {
    let active = true
    async function resolve() {
      if (row.empresa_id) {
        const conv = await supabase.from('empresas_conveniadas').select('nome_fantasia').eq('id', row.empresa_id).maybeSingle()
        let nome = (conv.data as any)?.nome_fantasia
        if (!nome) {
          const comp = await supabase.from('companies').select('legal_name').eq('id', row.empresa_id).maybeSingle()
          nome = (comp.data as any)?.legal_name
        }
        if (active) setEmpresaNome(nome ?? null)
        return
      }
      // Sem vínculo: reconstrói o motivo com a mesma regra da importação.
      if (row.produto_id === null || row.produto_id === undefined) {
        if (active) setMotivo(MOTIVO_PENDENCIA.nao_encontrado); return
      }
      const { data } = await supabase.from('empresas_produtos')
        .select('empresa_id').eq('produto_id', row.produto_id).eq('ativo', true).limit(5)
      const qtd = ((data as any[]) ?? []).length
      if (active) setMotivo(qtd > 1 ? MOTIVO_PENDENCIA.ambiguo : MOTIVO_PENDENCIA.nao_encontrado)
    }
    resolve()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id])

  const sit = SITUACAO_INADIMPLENCIA[row.situacao] ?? { label: row.situacao, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
  const dias = row.situacao === 'em_aberto' ? diasEmAberto(row.vencimento) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Detalhe do título">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative h-screen w-[440px] max-w-[92vw] bg-white shadow-xl flex flex-col animate-none">
        {/* Assinatura institucional discreta (faixa 2–3px) */}
        <div className="h-[3px] bg-vg-institucional" />
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{row.razao_social_planilha || 'Título de inadimplência'}</h2>
            <div className="mt-1"><span className={cn('badge', sit.badge)}>{sit.label}</span></div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar detalhe"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Vínculo com a empresa */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Empresa vinculada</div>
            {row.empresa_id ? (
              <Link href={`/empresas/${row.empresa_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--vg-brand-500)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                {empresaNome ?? 'Ver cadastro da empresa'} <ExternalLink size={13} />
              </Link>
            ) : (
              <div className="text-sm text-amber-700">
                Sem vínculo automático{motivo ? <> — <span className="font-medium">{motivo}</span></> : ''}.
                <div className="text-xs text-gray-500 mt-0.5">Razão social da planilha: {row.razao_social_planilha || '—'}</div>
              </div>
            )}
          </div>

          {/* Bloco 1 — Título */}
          <Bloco titulo="Título">
            <Campo label="Razão social (planilha)" full>{disp(row.razao_social_planilha)}</Campo>
            <Campo label="Parceiro">{disp(row.parceiro_planilha)}</Campo>
            <Campo label="ID (planilha)"><span className="font-mono">{disp(row.id_produto_raw)}</span></Campo>
            <Campo label="Produto (numérico)"><span className="font-mono">{row.produto_id ?? '—'}</span></Campo>
            <Campo label="Sufixo"><span className="font-mono">{disp(row.sufixo)}</span></Campo>
            <Campo label="Vencimento">{fmtDateBR(row.vencimento)}</Campo>
            <Campo label="Dias em aberto">{dias === null ? '—' : `${dias} dia${dias === 1 ? '' : 's'}`}</Campo>
            <Campo label="Valor">{fmtBRL(row.valor)}</Campo>
            <Campo label="Tipo">{disp(row.tipo)}</Campo>
            <Campo label="Banco">{disp(row.banco)}</Campo>
            <Campo label="Cód. boleto"><span className="font-mono">{disp(row.cod_boleto)}</span></Campo>
            <Campo label="Situação">{sit.label}</Campo>
            <Campo label="Mês de referência">{fmtMes(row.mes_referencia)}</Campo>
            <Campo label="Situação do cadastro (ATIVO/INATIVO)">{disp(row.situacao_cadastro)}</Campo>
            <Campo label="Status de bloqueio" full wrap>{disp(row.status_bloqueio)}</Campo>
          </Bloco>

          {/* Bloco 2 — Informações internas (oculto no futuro para parceiro externo) */}
          {MOSTRAR_INFO_INTERNA && <BlocoInformacoesInternas row={row} />}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">Visualização somente leitura.</div>
      </div>
    </div>
  )
}

/*
 * Bloco 2 — dados internos. Componente próprio, renderizado sob uma condição
 * única (MOSTRAR_INFO_INTERNA) para que, ao existir controle de acesso por
 * perfil, ocultar TODO o conteúdo interno do parceiro externo seja trivial.
 */
function BlocoInformacoesInternas({ row }: { row: any }) {
  return (
    <Bloco titulo="Informações internas" icon={<Lock size={13} className="text-gray-400" />}>
      <Campo label="Data de liquidação">{fmtDateBR(row.data_liquidacao)}</Campo>
      <Campo label="Pagamento com juros">{row.pagamento_com_juros === true ? 'Sim' : row.pagamento_com_juros === false ? 'Não' : '—'}</Campo>
      <Campo label="Status de cartório" full wrap>{disp(row.status_cartorio)}</Campo>
      <Campo label="Quitado em">{fmtDateBR(row.quitado_em)}</Campo>
      <Campo label="Primeira detecção">{fmtDateBR(row.primeira_deteccao)}</Campo>
      <Campo label="Última detecção">{fmtDateBR(row.ultima_deteccao)}</Campo>
    </Bloco>
  )
}

function Bloco({ titulo, icon, children }: { titulo: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{titulo}</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </section>
  )
}

function Campo({ label, children, full, wrap }: { label: string; children: React.ReactNode; full?: boolean; wrap?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[11px] text-gray-400 mb-0.5">{label}</div>
      <div className={cn('text-sm text-gray-800', wrap ? 'whitespace-pre-wrap break-words' : 'break-words')}>{children}</div>
    </div>
  )
}

const disp = (s: unknown) => (s !== null && s !== undefined && String(s).trim() !== '' ? String(s) : '—')
