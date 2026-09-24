'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Upload, History, Search, Eye, X, ExternalLink, Lock, Mail, Copy, Check, AlertTriangle, RotateCcw, CheckCircle2, Pencil } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  SITUACAO_INADIMPLENCIA, MOTIVO_PENDENCIA, diasAtraso, labelDiasAtraso, fmtBRL, fmtDateBR, fmtMes, normKey,
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

const COLS = '1fr 120px 80px 95px 105px 110px 100px 120px 90px 44px'

export default function InadimplenciaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [parceiros, setParceiros] = useState<string[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return
      const { data } = await supabase.from('users_profile').select('id').eq('email', user.email).maybeSingle()
      setCurrentUserId((data as any)?.id ?? null)
    })
  }, [])

  // Alterna "informado ao parceiro" direto na lista (só para quitados). Atualiza
  // a linha localmente (sem recarregar) e registra no histórico.
  async function toggleInformado(r: any) {
    const antesInformado = !!r.quitado_informado_em
    const agora = new Date().toISOString()
    const novo = antesInformado ? null : agora
    setRows(prev => prev.map(x => (x.id === r.id ? { ...x, quitado_informado_em: novo } : x)))
    const { error } = await supabase.from('inadimplencias')
      .update({ quitado_informado_em: novo, atualizado_em: agora }).eq('id', r.id)
    if (error) {
      setRows(prev => prev.map(x => (x.id === r.id ? { ...x, quitado_informado_em: r.quitado_informado_em } : x)))
      return
    }
    await supabase.from('inadimplencia_historico').insert({
      inadimplencia_id: r.id,
      campo: 'Informado ao parceiro',
      valor_anterior: antesInformado ? 'Sim' : 'Não',
      valor_novo: novo ? 'Sim' : 'Não',
      alterado_por: currentUserId,
      alterado_em: agora,
    })
  }

  // A situação NÃO é filtrada no servidor: os totalizadores respeitam todos os
  // filtros menos o de situação (cada card mostra a sua). O filtro de situação
  // é aplicado no cliente, só sobre a tabela/e-mail.
  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase.from('inadimplencias').select('*').order('vencimento', { ascending: true }).limit(2000)
      if (fParceiro) q = q.eq('parceiro_planilha', fParceiro)
      if (fDe) q = q.gte('vencimento', fDe)
      if (fAte) q = q.lte('vencimento', fAte)
      const { data } = await q
      setRows((data as any[]) ?? [])
      setLoading(false)
    }
    load()
  }, [fParceiro, fDe, fAte, reloadKey])

  // Base para os totalizadores: aplica parceiro/período (servidor) + atraso/busca
  // (cliente), mas NÃO a situação.
  const baseFiltered = useMemo(() => {
    const q = normKey(busca)
    return rows.filter(r => {
      if (!dentroDaFaixa(diasAtraso(r), fFaixa)) return false
      if (q) {
        const hay = normKey(r.razao_social_planilha) + ' ' + normKey(r.id_produto_raw)
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, busca, fFaixa])

  // Tabela e e-mail: base + filtro de situação (inclui os recortes de quitados
  // por controle de informe).
  const filtered = useMemo(() => {
    if (!fSituacao) return baseFiltered
    if (fSituacao === 'quitado_a_informar') return baseFiltered.filter(r => r.situacao === 'quitado' && !r.quitado_informado_em)
    if (fSituacao === 'quitado_informado') return baseFiltered.filter(r => r.situacao === 'quitado' && !!r.quitado_informado_em)
    return baseFiltered.filter(r => r.situacao === fSituacao)
  }, [baseFiltered, fSituacao])

  const totais = useMemo(() => {
    const soma = (arr: any[]) => arr.reduce((s, r) => s + (Number(r.valor) || 0), 0)
    const abertos = baseFiltered.filter(r => r.situacao === 'em_aberto')
    const quitados = baseFiltered.filter(r => r.situacao === 'quitado')
    const atrasos = quitados.map(r => diasAtraso(r)).filter((d): d is number => d !== null)
    const mediaAtraso = atrasos.length ? Math.round(atrasos.reduce((a, b) => a + b, 0) / atrasos.length) : null
    return {
      totalQtd: baseFiltered.length, totalSoma: soma(baseFiltered),
      abertoQtd: abertos.length, abertoSoma: soma(abertos),
      quitadoQtd: quitados.length, quitadoSoma: soma(quitados),
      mediaAtraso,
    }
  }, [baseFiltered])

  const mediaAtrasoLabel = totais.mediaAtraso === null ? '—'
    : totais.mediaAtraso <= 0 ? 'no prazo'
    : `${totais.mediaAtraso} dia${totais.mediaAtraso === 1 ? '' : 's'}`

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Inadimplência</h1>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length} registro(s) · controle interno por importação de planilha</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inadimplencia/importacoes" className="btn"><History size={15} /> Importações</Link>
          <button type="button" onClick={() => setEmailOpen(true)} disabled={filtered.length === 0}
            title={filtered.length === 0 ? 'Nenhum título no filtro atual para gerar o e-mail' : undefined}
            className="btn disabled:opacity-50 disabled:cursor-not-allowed"><Mail size={15} /> Gerar e-mail</button>
          <Link href="/inadimplencia/importar" className="btn-primary"><Upload size={15} /> Importar planilha</Link>
        </div>
      </div>

      {/* Totalizadores — respeitam todos os filtros MENOS o de situação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardTotal label="Total de títulos" qtd={totais.totalQtd} valor={totais.totalSoma} />
        <CardTotal label="Em aberto" qtd={totais.abertoQtd} valor={totais.abertoSoma} valorClass="text-red-700" />
        <CardTotal label="Quitados" qtd={totais.quitadoQtd} valor={totais.quitadoSoma} valorClass="text-green-700" />
        <div className="card"><div className="card-body">
          <div className="text-xs text-gray-400">Média de atraso</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{mediaAtrasoLabel}</div>
          <div className="text-xs text-gray-400 mt-0.5">dos títulos quitados</div>
        </div></div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="select w-52" value={fParceiro} onChange={e => setFParceiro(e.target.value)}>
          <option value="">Todos os parceiros</option>
          {parceiros.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="select w-48" value={fSituacao} onChange={e => setFSituacao(e.target.value)}>
          <option value="">Todas as situações</option>
          {Object.entries(SITUACAO_INADIMPLENCIA).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          <option value="quitado_a_informar">Quitado — a informar</option>
          <option value="quitado_informado">Quitado — já informado</option>
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
          <span>Dias em atraso</span><span>Valor</span><span>Situação</span><span>Status bloqueio</span><span>Informado</span><span className="sr-only">Detalhe</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum registro encontrado.</div>
        ) : filtered.slice(0, 500).map(r => {
          const sit = SITUACAO_INADIMPLENCIA[r.situacao] ?? { label: r.situacao, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
          const emAberto = r.situacao === 'em_aberto'
          const dias = diasAtraso(r)               // em aberto: venc→hoje; quitado: venc→pagamento
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
                {/* Destaque de alerta (âmbar/vermelho) só para EM ABERTO com muitos
                    dias; quitado é sempre neutro, mesmo com atraso alto. */}
                <span className={cn(
                  emAberto && dias !== null && dias > 90 ? 'text-red-700 font-medium'
                    : emAberto && dias !== null && dias > 30 ? 'text-amber-700'
                    : 'text-gray-600',
                )}>{labelDiasAtraso(r)}</span>
              </span>
              <span className="text-sm text-gray-800 self-center">{fmtBRL(r.valor)}</span>
              <span className="self-center"><span className={cn('badge', sit.badge)}>{sit.label}</span></span>
              <span className="text-xs text-gray-500 self-center truncate">{r.status_bloqueio || '—'}</span>
              <span className="self-center flex justify-center" onClick={e => e.stopPropagation()}>
                {r.situacao === 'quitado' ? (
                  <input type="checkbox" aria-label="Informado ao parceiro"
                    checked={!!r.quitado_informado_em}
                    title={r.quitado_informado_em ? `Informado em ${formatDate(r.quitado_informado_em)}` : 'Não informado ao parceiro'}
                    onChange={() => toggleInformado(r)}
                    className="cursor-pointer" />
                ) : null}
              </span>
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

      {selected && <DetalheDrawer row={selected} onClose={() => setSelected(null)} onChanged={() => setReloadKey(k => k + 1)} />}
      {emailOpen && <EmailModal rows={filtered} parceiro={fParceiro} situacao={fSituacao} onClose={() => setEmailOpen(false)} onMarked={() => setReloadKey(k => k + 1)} />}
    </div>
  )
}

// ————————————————————————————————————————————————————————————————
// Drawer de detalhe (somente leitura): Esc e clique fora fecham; foco visível.
// ————————————————————————————————————————————————————————————————
function DetalheDrawer({ row, onClose, onChanged }: { row: any; onClose: () => void; onChanged?: () => void }) {
  const supabase = createClient()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [empresaNome, setEmpresaNome] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)

  // Situação/quitado_em locais — refletem o ajuste manual sem recarregar a tela
  const [situacao, setSituacao] = useState<string>(row.situacao)
  const [quitadoEm, setQuitadoEm] = useState<string | null>(row.quitado_em ?? null)

  // Ajustes manuais (situação) + histórico de campos + apoio
  const [ajustes, setAjustes] = useState<any[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Fluxo de confirmação do ajuste
  const [confirmando, setConfirmando] = useState(false)
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)
  const [ajusteErro, setAjusteErro] = useState('')

  // Edição manual dos campos editáveis (persistidos) + rascunho durante a edição
  const [vals, setVals] = useState<EditVals>(() => valsFromRow(row))
  const [draft, setDraft] = useState<EditVals>(vals)
  const [editando, setEditando] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [edicaoErro, setEdicaoErro] = useState('')
  const onField = (k: keyof EditVals, v: string) => setDraft(d => ({ ...d, [k]: v }))

  // Esc fecha
  const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onKey])

  // Carrega ajustes manuais, histórico de campos, nomes e usuário logado
  const carregarAjustes = useCallback(async () => {
    const { data } = await supabase.from('inadimplencia_ajustes').select('*')
      .eq('inadimplencia_id', row.id).order('ajustado_em', { ascending: false })
    setAjustes((data as any[]) ?? [])
  }, [row.id, supabase])

  const carregarHistorico = useCallback(async () => {
    const { data } = await supabase.from('inadimplencia_historico').select('*')
      .eq('inadimplencia_id', row.id).order('alterado_em', { ascending: false })
    setHistorico((data as any[]) ?? [])
  }, [row.id, supabase])

  useEffect(() => {
    carregarAjustes()
    carregarHistorico()
    supabase.from('users_profile').select('id, full_name').then(({ data }) => {
      setUsersMap(Object.fromEntries(((data as any[]) ?? []).map(u => [u.id, u.full_name])))
    })
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return
      const { data } = await supabase.from('users_profile').select('id').eq('email', user.email).maybeSingle()
      setCurrentUserId((data as any)?.id ?? null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id])

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

  const sit = SITUACAO_INADIMPLENCIA[situacao] ?? { label: situacao, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
  // Dias em atraso — mesma regra da lista, usando a situação/quitado_em locais.
  const diasAtrasoLabel = labelDiasAtraso({ situacao, vencimento: row.vencimento, quitado_em: quitadoEm })

  // Alvo da reversão manual: alterna entre em_aberto e quitado.
  const novaSituacao = situacao === 'quitado' ? 'em_aberto' : 'quitado'

  async function aplicarAjuste() {
    const mot = motivoAjuste.trim()
    if (!mot) { setAjusteErro('Informe o motivo do ajuste.'); return }
    setSalvandoAjuste(true); setAjusteErro('')
    const agora = new Date().toISOString()
    const novoQuitadoEm = novaSituacao === 'quitado' ? agora : null

    const { error: upErr } = await supabase.from('inadimplencias')
      .update({ situacao: novaSituacao, quitado_em: novoQuitadoEm, atualizado_em: agora }).eq('id', row.id)
    if (upErr) { setSalvandoAjuste(false); setAjusteErro('Erro ao atualizar a situação: ' + upErr.message); return }

    const { error: hErr } = await supabase.from('inadimplencia_ajustes').insert({
      inadimplencia_id: row.id,
      situacao_anterior: situacao,
      situacao_nova: novaSituacao,
      motivo: mot,
      ajustado_por: currentUserId,
      ajustado_em: agora,
    })
    // A situação já foi alterada; se o histórico falhar, avisa mas não reverte.
    if (hErr) setAjusteErro('Situação alterada, mas houve erro ao gravar o histórico: ' + hErr.message)

    setSituacao(novaSituacao)
    setQuitadoEm(novoQuitadoEm)
    setConfirmando(false)
    setMotivoAjuste('')
    setSalvandoAjuste(false)
    carregarAjustes()
    onChanged?.()
  }

  function iniciarEdicao() { setDraft(vals); setEditando(true); setEdicaoErro(''); setConfirmando(false) }
  function cancelarEdicao() { setDraft(vals); setEditando(false); setEdicaoErro('') }

  async function salvarEdicao() {
    setSalvandoEdicao(true); setEdicaoErro('')
    const agora = new Date().toISOString()
    const update: Record<string, any> = {}
    const histRows: any[] = []
    for (const c of CAMPOS_EDIT) {
      const antes = c.db(vals[c.key])
      const depois = c.db(draft[c.key])
      if (antes === depois) continue
      update[c.key] = depois
      histRows.push({
        inadimplencia_id: row.id,
        campo: c.label,
        valor_anterior: c.readable(vals[c.key]),
        valor_novo: c.readable(draft[c.key]),
        alterado_por: currentUserId,
        alterado_em: agora,
      })
    }
    // Nada mudou: sai da edição sem gravar nada (nem update, nem histórico).
    if (histRows.length === 0) { setEditando(false); setSalvandoEdicao(false); return }

    update.atualizado_em = agora
    const { error: upErr } = await supabase.from('inadimplencias').update(update).eq('id', row.id)
    if (upErr) { setSalvandoEdicao(false); setEdicaoErro('Erro ao salvar: ' + upErr.message); return }

    const { error: hErr } = await supabase.from('inadimplencia_historico').insert(histRows)
    if (hErr) setEdicaoErro('Alterações salvas, mas houve erro ao gravar o histórico: ' + hErr.message)

    setVals(draft)
    setEditando(false)
    setSalvandoEdicao(false)
    carregarHistorico()
    onChanged?.()
  }

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
            <Campo label="Dias em atraso">{diasAtrasoLabel}</Campo>
            <Campo label="Valor">{fmtBRL(row.valor)}</Campo>
            <Campo label="Tipo">{disp(row.tipo)}</Campo>
            <Campo label="Banco">{disp(row.banco)}</Campo>
            <Campo label="Cód. boleto"><span className="font-mono">{disp(row.cod_boleto)}</span></Campo>
            <Campo label="Situação">{sit.label}</Campo>
            <Campo label="Mês de referência">{fmtMes(row.mes_referencia)}</Campo>
            <Campo label="Situação do cadastro (ATIVO/INATIVO)">{disp(row.situacao_cadastro)}</Campo>
            <Campo label="Status de bloqueio" full wrap>
              {editando
                ? <input className="input" value={draft.status_bloqueio} onChange={e => onField('status_bloqueio', e.target.value)} placeholder="Ex.: Bloqueado, Liberado..." />
                : disp(vals.status_bloqueio)}
            </Campo>
          </Bloco>

          {/* Bloco 2 — Informações internas + histórico de ajustes manuais
              (oculto no futuro para parceiro externo) */}
          {MOSTRAR_INFO_INTERNA && (
            <>
              <BlocoInformacoesInternas row={{ ...row, situacao, quitado_em: quitadoEm }}
                vals={vals} draft={draft} editando={editando} onField={onField} />
              <BlocoHistorico historico={historico} usersMap={usersMap} />
              <BlocoAjustes ajustes={ajustes} usersMap={usersMap} />
            </>
          )}
        </div>

        {/* Rodapé — edição de campos e reversão manual da situação */}
        <div className="px-5 py-3 border-t border-gray-100">
          {editando ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Editando os campos acima. A situação (em aberto/quitado) muda pelo ajuste manual, não aqui.</p>
              {edicaoErro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{edicaoErro}</p>}
              <div className="flex items-center gap-2">
                <button type="button" onClick={salvarEdicao} disabled={salvandoEdicao} className="btn-primary disabled:opacity-50">
                  {salvandoEdicao ? 'Salvando...' : <><Check size={14} /> Salvar</>}
                </button>
                <button type="button" onClick={cancelarEdicao} disabled={salvandoEdicao} className="btn">Cancelar</button>
              </div>
            </div>
          ) : !confirmando ? (
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={iniciarEdicao} className="btn btn-sm"><Pencil size={14} /> Editar</button>
              <button type="button" onClick={() => { setConfirmando(true); setAjusteErro('') }}
                className="btn btn-sm whitespace-nowrap">
                {situacao === 'quitado' ? <><RotateCcw size={14} /> Reabrir título</> : <><CheckCircle2 size={14} /> Marcar como quitado</>}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Alterar situação de <span className="font-medium">{SITUACAO_INADIMPLENCIA[situacao]?.label ?? situacao}</span>
                {' '}para <span className="font-medium">{SITUACAO_INADIMPLENCIA[novaSituacao]?.label ?? novaSituacao}</span>?
              </p>
              <p className="text-xs text-gray-400">
                A próxima importação continua mandando: se este título não vier no próximo arquivo, volta a ser quitado automaticamente. O ajuste corrige apenas o intervalo até lá.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="motivo-ajuste">Motivo (obrigatório)</label>
                <input id="motivo-ajuste" className="input" value={motivoAjuste} autoFocus
                  onChange={e => setMotivoAjuste(e.target.value)}
                  placeholder="Ex.: quitação confirmada fora da planilha; erro na última importação..." />
              </div>
              {ajusteErro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{ajusteErro}</p>}
              <div className="flex items-center gap-2">
                <button type="button" onClick={aplicarAjuste} disabled={salvandoAjuste || !motivoAjuste.trim()}
                  className="btn-primary disabled:opacity-50">
                  {salvandoAjuste ? 'Aplicando...' : 'Confirmar'}
                </button>
                <button type="button" onClick={() => { setConfirmando(false); setMotivoAjuste(''); setAjusteErro('') }}
                  disabled={salvandoAjuste} className="btn">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/*
 * Histórico de ajustes MANUAIS de situação (interno). Renderizado apenas sob
 * MOSTRAR_INFO_INTERNA, junto do bloco de informações internas.
 */
function BlocoAjustes({ ajustes, usersMap }: { ajustes: any[]; usersMap: Record<string, string> }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <History size={13} className="text-gray-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ajustes manuais de situação</h3>
      </div>
      {ajustes.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum ajuste manual neste título.</p>
      ) : (
        <ol className="space-y-2">
          {ajustes.map(a => (
            <li key={a.id} className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3">
              <div>
                <span className="text-gray-500">{SITUACAO_INADIMPLENCIA[a.situacao_anterior]?.label ?? a.situacao_anterior}</span>
                <span className="text-gray-400"> → </span>
                <span className="font-medium text-gray-900">{SITUACAO_INADIMPLENCIA[a.situacao_nova]?.label ?? a.situacao_nova}</span>
              </div>
              {a.motivo && <div className="text-xs text-gray-600 mt-0.5 break-words">{a.motivo}</div>}
              <div className="text-xs text-gray-400 mt-0.5">
                {usersMap[a.ajustado_por] ?? '—'} · {formatDate(a.ajustado_em)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/*
 * Bloco 2 — dados internos. Componente próprio, renderizado sob uma condição
 * única (MOSTRAR_INFO_INTERNA) para que, ao existir controle de acesso por
 * perfil, ocultar TODO o conteúdo interno do parceiro externo seja trivial.
 */
function BlocoInformacoesInternas({ row, vals, draft, editando, onField }: {
  row: any; vals: EditVals; draft: EditVals; editando: boolean; onField: (k: keyof EditVals, v: string) => void
}) {
  return (
    <Bloco titulo="Informações internas" icon={<Lock size={13} className="text-gray-400" />}>
      <Campo label="Data de liquidação">
        {editando
          ? <input type="date" className="input" value={draft.data_liquidacao} onChange={e => onField('data_liquidacao', e.target.value)} />
          : fmtDateBR(vals.data_liquidacao || null)}
      </Campo>
      <Campo label="Pagamento com juros">
        {editando ? (
          <select className="select" value={draft.pagamento_com_juros} onChange={e => onField('pagamento_com_juros', e.target.value)}>
            <option value="">—</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        ) : jurosLabel(vals.pagamento_com_juros)}
      </Campo>
      <Campo label="Status de cartório" full wrap>
        {editando
          ? <input className="input" value={draft.status_cartorio} onChange={e => onField('status_cartorio', e.target.value)} placeholder="Ex.: Protestado, Sem protesto..." />
          : disp(vals.status_cartorio)}
      </Campo>
      <Campo label="Anotação interna" full wrap>
        {editando
          ? <textarea className="input" rows={3} value={draft.anotacao} onChange={e => onField('anotacao', e.target.value)} placeholder="Observações internas sobre este título (não vão para o parceiro)." />
          : disp(vals.anotacao)}
      </Campo>
      <Campo label="Quitado em">{fmtDateBR(row.quitado_em)}</Campo>
      <Campo label="Informado ao parceiro">{row.quitado_informado_em ? `Sim · ${formatDate(row.quitado_informado_em)}` : 'Não'}</Campo>
      <Campo label="Primeira detecção">{fmtDateBR(row.primeira_deteccao)}</Campo>
      <Campo label="Última detecção">{fmtDateBR(row.ultima_deteccao)}</Campo>
    </Bloco>
  )
}

/*
 * Histórico de ALTERAÇÕES de campos (edição manual). Interno — renderizado sob
 * MOSTRAR_INFO_INTERNA, junto dos ajustes de situação. Ordem cronológica
 * decrescente (a query já ordena por alterado_em desc).
 */
function BlocoHistorico({ historico, usersMap }: { historico: any[]; usersMap: Record<string, string> }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <History size={13} className="text-gray-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Histórico de alterações</h3>
      </div>
      {historico.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma alteração de campo neste título.</p>
      ) : (
        <ol className="space-y-2">
          {historico.map(h => (
            <li key={h.id} className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3">
              <div className="font-medium text-gray-900">{h.campo}</div>
              <div className="text-xs">
                <span className="text-gray-500 break-words">{disp(h.valor_anterior)}</span>
                <span className="text-gray-400"> → </span>
                <span className="text-gray-800 break-words">{disp(h.valor_novo)}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{usersMap[h.alterado_por] ?? '—'} · {formatDate(h.alterado_em)}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
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

// Card de totalizador: quantidade em destaque + valor somado abaixo.
function CardTotal({ label, qtd, valor, valorClass }: { label: string; qtd: number; valor: number; valorClass?: string }) {
  return (
    <div className="card"><div className="card-body">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{qtd}</div>
      <div className={cn('text-sm font-semibold mt-0.5', valorClass ?? 'text-gray-500')}>{fmtBRL(valor)}</div>
    </div></div>
  )
}

// ————————————————————————————————————————————————————————————————
// Edição manual de campos do título. A situação (em aberto/quitado) NÃO entra
// aqui — muda pelo botão de ajuste manual, com motivo obrigatório.
// ————————————————————————————————————————————————————————————————
interface EditVals {
  status_bloqueio: string
  status_cartorio: string
  data_liquidacao: string     // 'AAAA-MM-DD' | ''
  pagamento_com_juros: string // 'sim' | 'nao' | ''
  anotacao: string
}

function valsFromRow(row: any): EditVals {
  return {
    status_bloqueio: row.status_bloqueio ?? '',
    status_cartorio: row.status_cartorio ?? '',
    data_liquidacao: row.data_liquidacao ? String(row.data_liquidacao).slice(0, 10) : '',
    pagamento_com_juros: row.pagamento_com_juros === true ? 'sim' : row.pagamento_com_juros === false ? 'nao' : '',
    anotacao: row.anotacao ?? '',
  }
}

const jurosLabel = (v: string) => (v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : '—')

// Descritores dos campos editáveis: valor para o banco (db) e valor legível
// para o histórico (readable). Usados no diff do salvamento.
const CAMPOS_EDIT: {
  key: keyof EditVals
  label: string
  db: (v: string) => string | boolean | null
  readable: (v: string) => string
}[] = [
  { key: 'status_bloqueio', label: 'Status de bloqueio', db: v => v.trim() || null, readable: v => v.trim() || '—' },
  { key: 'status_cartorio', label: 'Status de cartório', db: v => v.trim() || null, readable: v => v.trim() || '—' },
  { key: 'data_liquidacao', label: 'Data de liquidação', db: v => v || null, readable: v => fmtDateBR(v || null) },
  { key: 'pagamento_com_juros', label: 'Pagamento com juros', db: v => (v === 'sim' ? true : v === 'nao' ? false : null), readable: v => jurosLabel(v) },
  { key: 'anotacao', label: 'Anotação interna', db: v => v.trim() || null, readable: v => v.trim() || '—' },
]

// ————————————————————————————————————————————————————————————————
// Geração de e-mail de cobrança (nada é enviado — apenas copiado).
//
// SEGURANÇA: o e-mail é para destinatário EXTERNO. Ele é montado a partir de
// uma lista EXPLÍCITA de campos permitidos (empresa, ID, vencimento, valor,
// status de bloqueio) — nunca iterando o objeto inteiro. Assim, campos do
// bloco "Informações internas" (data de liquidação, pagamento com juros,
// status de cartório, quitado em, primeira/última detecção) nunca entram.
// ————————————————————————————————————————————————————————————————
// Linhas para as tabelas do e-mail. Só campos PERMITIDOS (externos). O valor já
// vem numérico; as demais colunas já vêm formatadas em texto.
interface EmailCell { empresa: string; id: string; venc: string; valor: number | null; extra: string }

/** Títulos em aberto (segunda tabela) — coluna extra = Status de bloqueio. */
function linhasAberto(rows: any[]): EmailCell[] {
  return [...rows]
    .sort((a, b) => String(a.vencimento ?? '').localeCompare(String(b.vencimento ?? '')))
    .map(r => ({
      empresa: (r.razao_social_planilha ?? '').toString().trim() || '—',
      id: (r.id_produto_raw ?? '').toString().trim() || '—',
      venc: fmtDateBR(r.vencimento),
      valor: typeof r.valor === 'number' ? r.valor : (r.valor != null ? Number(r.valor) : null),
      extra: (r.status_bloqueio ?? '').toString().trim() || '—',
    }))
}

/** Pagamentos confirmados (primeira tabela) — coluna extra = Pago em (data). */
function linhasPagos(rows: any[]): EmailCell[] {
  return [...rows]
    .sort((a, b) => String(a.vencimento ?? '').localeCompare(String(b.vencimento ?? '')))
    .map(r => ({
      empresa: (r.razao_social_planilha ?? '').toString().trim() || '—',
      id: (r.id_produto_raw ?? '').toString().trim() || '—',
      venc: fmtDateBR(r.vencimento),
      valor: typeof r.valor === 'number' ? r.valor : (r.valor != null ? Number(r.valor) : null),
      extra: fmtDateBR(r.quitado_em ? String(r.quitado_em).slice(0, 10) : null),
    }))
}

function assuntoEmail(parceiro: string): string {
  const alvo = parceiro || 'Vegas Card'
  return `Títulos em aberto — ${alvo} — ${new Date().toLocaleDateString('pt-BR')}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Tabela HTML autocontida (estilos inline — CSS vars não sobrevivem ao Outlook).
// Colunas: Empresa | ID | Vencimento | Valor | <extraHeader>. Valor no índice 3.
function tabelaHtml(extraHeader: string, linhas: EmailCell[]): string {
  const qtd = linhas.length
  const soma = linhas.reduce((s, l) => s + (l.valor ?? 0), 0)
  const th = 'style="text-align:left;border:1px solid #cccccc;padding:6px 10px;background:#f2f2f7;font-weight:600;"'
  const td = 'style="border:1px solid #cccccc;padding:6px 10px;vertical-align:top;"'
  const tdR = 'style="border:1px solid #cccccc;padding:6px 10px;vertical-align:top;text-align:right;white-space:nowrap;"'
  const corpo = linhas.map(l => (
    `<tr><td ${td}>${esc(l.empresa)}</td><td ${td}>${esc(l.id)}</td>` +
    `<td ${tdR}>${esc(l.venc)}</td><td ${tdR}>${esc(fmtBRL(l.valor))}</td><td ${td}>${esc(l.extra)}</td></tr>`
  )).join('')
  return (
    `<table style="border-collapse:collapse;font-size:13px;margin:6px 0 14px;">` +
    `<thead><tr><th ${th}>Empresa</th><th ${th}>ID</th><th ${th}>Vencimento</th><th ${th}>Valor</th><th ${th}>${esc(extraHeader)}</th></tr></thead>` +
    `<tbody>${corpo}</tbody>` +
    `<tfoot><tr>` +
    `<td colspan="3" style="border:1px solid #cccccc;padding:6px 10px;background:#f2f2f7;font-weight:600;text-align:right;">Total — ${qtd} título${qtd === 1 ? '' : 's'}</td>` +
    `<td style="border:1px solid #cccccc;padding:6px 10px;background:#f2f2f7;font-weight:600;text-align:right;white-space:nowrap;">${esc(fmtBRL(soma))}</td>` +
    `<td style="border:1px solid #cccccc;background:#f2f2f7;"></td>` +
    `</tr></tfoot></table>`
  )
}

function tabelaTexto(extraHeader: string, linhas: EmailCell[]): string {
  const header = ['Empresa', 'ID', 'Vencimento', 'Valor', extraHeader]
  const data = linhas.map(l => [l.empresa, l.id, l.venc, fmtBRL(l.valor), l.extra])
  const widths = header.map((h, i) => Math.max(h.length, ...data.map(r => r[i].length)))
  const pad = (s: string, w: number, right = false) => (right ? s.padStart(w) : s.padEnd(w))
  const linha = (cells: string[]) => cells.map((c, i) => pad(c, widths[i], i === 3)).join('  ').trimEnd()
  const regua = widths.map(w => '-'.repeat(w)).join('  ')
  const qtd = linhas.length
  const soma = linhas.reduce((s, l) => s + (l.valor ?? 0), 0)
  return [linha(header), regua, ...data.map(linha), regua, `Total: ${qtd} título${qtd === 1 ? '' : 's'} — ${fmtBRL(soma)}`].join('\n')
}

// Corpo completo (HTML): primeira tabela (pagamentos confirmados, omitida se
// vazia — a coluna "Pago em" traz a data real de cada título) + segunda tabela
// (títulos em aberto).
function corpoEmailHtml(pagos: EmailCell[], aberto: EmailCell[], parceiro: string): string {
  const alvo = parceiro || 'Vegas Card'
  const partes: string[] = [`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;line-height:1.5;">`, `<p>Prezados,</p>`]
  if (pagos.length > 0) {
    partes.push(`<p><b>Pagamentos confirmados</b></p>`)
    partes.push(tabelaHtml('Pago em', pagos))
  }
  partes.push(`<p>Segue a relação de títulos em aberto${parceiro ? ` referente a ${esc(alvo)}` : ''}. Pedimos a gentileza de nos retornar sobre a regularização dos valores abaixo.</p>`)
  partes.push(`<p><b>Títulos em aberto</b></p>`)
  partes.push(tabelaHtml('Status de bloqueio', aberto))
  partes.push(`<p>Permanecemos à disposição para quaisquer esclarecimentos.</p>`)
  partes.push(`<p>Atenciosamente,<br/>Vegas Card</p></div>`)
  return partes.join('')
}

// Corpo completo (text/plain) — fallback.
function corpoEmailTexto(pagos: EmailCell[], aberto: EmailCell[], parceiro: string): string {
  const alvo = parceiro || 'Vegas Card'
  const linhas: string[] = ['Prezados,', '']
  if (pagos.length > 0) {
    linhas.push('Pagamentos confirmados', '', tabelaTexto('Pago em', pagos), '')
  }
  linhas.push(`Segue a relação de títulos em aberto${parceiro ? ` referente a ${alvo}` : ''}. Pedimos a gentileza de nos retornar sobre a regularização dos valores abaixo.`, '')
  linhas.push('Títulos em aberto', '', tabelaTexto('Status de bloqueio', aberto), '')
  linhas.push('Permanecemos à disposição para quaisquer esclarecimentos.', '', 'Atenciosamente,', 'Vegas Card')
  return linhas.join('\n')
}

async function copiarRico(html: string, texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof window !== 'undefined' && 'ClipboardItem' in window) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([texto], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      return true
    }
  } catch { /* cai no fallback text/plain */ }
  try { await navigator.clipboard.writeText(texto); return true } catch { return false }
}

function chunkIds<T>(a: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}

function EmailModal({ rows, parceiro, situacao, onClose, onMarked }: { rows: any[]; parceiro: string; situacao: string; onClose: () => void; onMarked?: () => void }) {
  const supabase = createClient()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copiado, setCopiado] = useState<'assunto' | 'corpo' | null>(null)

  // Primeira tabela — pagamentos confirmados ainda NÃO informados ao parceiro
  // (situacao='quitado' e quitado_informado_em IS NULL), do parceiro filtrado
  // (ou de todos). O checkbox passa a incluir também os já informados.
  const [quitados, setQuitados] = useState<any[]>([])
  const [incluirInformados, setIncluirInformados] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [ultimoEnvio, setUltimoEnvio] = useState<{ enviado_em: string; nome: string } | null | undefined>(undefined)

  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onKey])

  // Usuário logado (users_profile.id)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return
      const { data } = await supabase.from('users_profile').select('id').eq('email', user.email).maybeSingle()
      setCurrentUserId((data as any)?.id ?? null)
    })
  }, [supabase])

  // Último envio registrado para o parceiro (ou "Todos")
  useEffect(() => {
    const alvo = parceiro || 'Todos'
    let active = true
    supabase.from('inadimplencia_envios').select('enviado_em, enviado_por').eq('parceiro', alvo)
      .order('enviado_em', { ascending: false }).limit(1)
      .then(async ({ data }) => {
        const env = (data as any[])?.[0]
        if (!env) { if (active) setUltimoEnvio(null); return }
        let nome = '—'
        if (env.enviado_por) {
          const { data: u } = await supabase.from('users_profile').select('full_name').eq('id', env.enviado_por).maybeSingle()
          nome = (u as any)?.full_name ?? '—'
        }
        if (active) setUltimoEnvio({ enviado_em: env.enviado_em, nome })
      })
    return () => { active = false }
  }, [parceiro, supabase])

  // Quitados a listar. Sempre situacao='quitado' + parceiro filtrado; sem o
  // checkbox, só os ainda não informados. Ordenado por quitado_em crescente.
  useEffect(() => {
    let active = true
    let q = supabase.from('inadimplencias')
      .select('id, razao_social_planilha, id_produto_raw, vencimento, valor, quitado_em, quitado_informado_em')
      .eq('situacao', 'quitado')
    if (parceiro) q = q.eq('parceiro_planilha', parceiro)
    if (!incluirInformados) q = q.is('quitado_informado_em', null)
    q.order('quitado_em', { ascending: true }).limit(5000)
      .then(({ data }) => { if (active) setQuitados((data as any[]) ?? []) })
    return () => { active = false }
  }, [parceiro, incluirInformados, supabase])

  const aberto = useMemo(() => linhasAberto(rows), [rows])
  const pagos = useMemo(() => linhasPagos(quitados), [quitados])
  const assunto = useMemo(() => assuntoEmail(parceiro), [parceiro])
  const html = useMemo(() => corpoEmailHtml(pagos, aberto, parceiro), [pagos, aberto, parceiro])
  const texto = useMemo(() => corpoEmailTexto(pagos, aberto, parceiro), [pagos, aberto, parceiro])
  const incluiQuitados = situacao !== 'em_aberto'
  // Só marca os que ainda não têm quitado_informado_em (mesmo com o checkbox on).
  const idsParaMarcar = useMemo(() => quitados.filter(q => !q.quitado_informado_em).map(q => q.id), [quitados])

  function flash(qual: 'assunto' | 'corpo') { setCopiado(qual); setTimeout(() => setCopiado(c => (c === qual ? null : c)), 1500) }
  async function copiarAssunto() { try { await navigator.clipboard.writeText(assunto); flash('assunto') } catch { /* ignore */ } }
  async function copiarCorpo() { if (await copiarRico(html, texto)) flash('corpo') }

  async function marcarInformados() {
    if (idsParaMarcar.length === 0) return
    setSalvando(true); setErro('')
    const agora = new Date().toISOString()
    for (const part of chunkIds(idsParaMarcar, 300)) {
      const { error } = await supabase.from('inadimplencias')
        .update({ quitado_informado_em: agora, atualizado_em: agora }).in('id', part)
      if (error) { setSalvando(false); setErro('Erro ao marcar os títulos: ' + error.message); return }
    }
    const valorAberto = aberto.reduce((s, l) => s + (l.valor ?? 0), 0)
    const { error: envErr } = await supabase.from('inadimplencia_envios').insert({
      parceiro: parceiro || 'Todos',
      qtd_quitados: pagos.length,
      qtd_abertos: aberto.length,
      valor_aberto: valorAberto,
      enviado_por: currentUserId,
      enviado_em: agora,
    })
    if (envErr) { setSalvando(false); setErro('Títulos marcados, mas houve erro ao registrar o envio: ' + envErr.message); return }
    setSalvando(false)
    onMarked?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Gerar e-mail de cobrança">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="h-[3px] bg-vg-institucional" />
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Gerar e-mail de cobrança</h2>
            <p className="text-xs text-gray-400 mt-0.5">{aberto.length} em aberto (filtro atual) · {pagos.length} pagamento(s) confirmado(s) · nada é enviado, apenas copiado</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Último envio registrado para o parceiro */}
          <div className="text-xs text-gray-500">
            {ultimoEnvio === undefined ? 'Verificando último envio...'
              : ultimoEnvio === null ? <>Nenhum envio registrado para <b>{parceiro || 'Todos'}</b>.</>
              : <>Último envio para <b>{parceiro || 'Todos'}</b>: {formatDate(ultimoEnvio.enviado_em)} · {ultimoEnvio.nome}</>}
          </div>

          {/* Incluir pagamentos já informados */}
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={incluirInformados} onChange={e => setIncluirInformados(e.target.checked)} />
            Incluir pagamentos já informados
            <span className="text-xs text-gray-400">(por padrão, só os ainda não comunicados)</span>
          </label>

          {incluiQuitados && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>O filtro de situação não está em <b>Em aberto</b>, então a tabela de títulos em aberto pode incluir títulos já <b>quitados</b>. Revise antes de enviar para evitar cobrança indevida.</span>
            </div>
          )}

          {/* Assunto */}
          <div className="form-group">
            <label className="form-label">Assunto</label>
            <div className="flex items-center gap-2">
              <input className="input flex-1" readOnly value={assunto} onFocus={e => e.currentTarget.select()} />
              <button type="button" onClick={copiarAssunto} className="btn whitespace-nowrap">
                {copiado === 'assunto' ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </button>
            </div>
          </div>

          {/* Corpo — prévia renderizada (igual ao que será colado) */}
          <div className="form-group">
            <div className="flex items-center justify-between mb-1">
              <label className="form-label mb-0">Corpo do e-mail</label>
              <button type="button" onClick={copiarCorpo} className="btn btn-sm">
                {copiado === 'corpo' ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar corpo</>}
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 overflow-x-auto bg-white">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Copiado como HTML (com fallback em texto): ao colar no Outlook, a tabela mantém a formatação.</p>
          </div>
        </div>

        {/* Rodapé — copiar corpo, marcar informados e fechar */}
        <div className="px-5 py-3 border-t border-gray-100">
          {confirmando ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-gray-700">Marcar <b>{idsParaMarcar.length}</b> pagamento(s) como informados ao parceiro <b>{parceiro || 'Todos'}</b>?</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={marcarInformados} disabled={salvando} className="btn-primary disabled:opacity-50">
                  {salvando ? 'Marcando...' : 'Confirmar'}
                </button>
                <button type="button" onClick={() => setConfirmando(false)} disabled={salvando} className="btn">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                {idsParaMarcar.length === 0
                  ? <span className="text-xs text-gray-400">Não há pagamentos novos a comunicar.</span>
                  : <span className="text-xs text-gray-500">{idsParaMarcar.length} pagamento(s) ainda sem marca de informe.</span>}
                {erro && <div className="text-xs text-red-600 mt-1">{erro}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={copiarCorpo} className="btn btn-sm">
                  {copiado === 'corpo' ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar corpo</>}
                </button>
                <button type="button" onClick={() => setConfirmando(true)} disabled={idsParaMarcar.length === 0}
                  title={idsParaMarcar.length === 0 ? 'Nenhum pagamento novo para marcar' : undefined}
                  className="btn disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle2 size={15} /> Marcar como informados
                </button>
                <button type="button" onClick={onClose} className="btn">Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
