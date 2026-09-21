'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Columns3 } from 'lucide-react'
import {
  mapHeader, normalizeLinha, chaveUnica, fmtBRL, fmtMes, fmtDateBR,
  MOTIVO_PENDENCIA, CAMPO_LABEL, type LinhaNormalizada, type ColunaKey, type HeaderMap,
} from '@/lib/inadimplencia'

/*
 * IMPORTAÇÃO DE INADIMPLÊNCIA (uso interno — time Vegas).
 *
 * Lê um .xlsx, normaliza cada linha, resolve o vínculo com a empresa via
 * empresas_produtos (produto_id + ativo=true) e mostra uma PRÉVIA. Só grava
 * após confirmação. Ao gravar:
 *  - upsert pela chave única (id_produto_raw, vencimento, valor): novas entram
 *    como em_aberto; existentes têm campos mutáveis + ultima_deteccao atualizados;
 *  - linhas sem vínculo (ou ambíguas) entram mesmo assim (empresa_id null) e
 *    geram uma pendência;
 *  - registros em_aberto dos parceiros deste arquivo que NÃO vieram nesta
 *    importação passam a quitado. Nenhum registro é apagado.
 */

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

interface RowPrep {
  linha: LinhaNormalizada
  empresa_id: string | null
  motivo: string | null   // chave em MOTIVO_PENDENCIA quando pendente
  nova: boolean
}

interface Preview {
  mesRef: string | null
  rows: RowPrep[]
  totalLinhas: number
  totalVinculadas: number
  totalPendentes: number
  totalNovas: number
  quitadosIds: string[]   // registros que serão marcados como quitados
  reconhecidas: { campo: ColunaKey; header: string }[]
  ignoradas: string[]
}

export default function ImportarInadimplenciaPage() {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [resultado, setResultado] = useState<{ novas: number; atualizadas: number; pendentes: number; quitadas: number } | null>(null)

  function reset() {
    setFileName(''); setPreview(null); setErro(''); setResultado(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setErro(''); setPreview(null); setResultado(null)
    setAnalisando(true)
    try {
      await analisar(file)
    } catch (err: any) {
      setErro(err?.message || 'Falha ao ler o arquivo.')
      setPreview(null)
    } finally {
      setAnalisando(false)
    }
  }

  async function analisar(file: File) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) throw new Error('A planilha não tem nenhuma aba legível.')
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })

    // Encontra a linha de cabeçalho (primeira que mapeia as colunas obrigatórias)
    let headerPos = -1
    let hmap: HeaderMap | null = null
    for (let i = 0; i < Math.min(matrix.length, 15); i++) {
      const m = mapHeader(matrix[i])
      if (m.faltando.length === 0) { headerPos = i; hmap = m; break }
    }
    if (headerPos < 0 || !hmap) {
      throw new Error('Cabeçalho não reconhecido. Confira se o arquivo tem as colunas obrigatórias: RAZÃO SOCIAL, ID, VALOR e VENC.')
    }
    const idx = hmap.index

    // Normaliza as linhas de dados (ignora linhas totalmente vazias)
    const dataRows = matrix.slice(headerPos + 1)
      .filter(r => Array.isArray(r) && r.some(c => String(c ?? '').replace(/ /g, ' ').trim() !== ''))
      .map(r => normalizeLinha(r, idx))
      .filter(l => l.id_produto_raw || l.razao_social_planilha)

    if (dataRows.length === 0) throw new Error('Nenhuma linha de dados encontrada na planilha.')

    // Vínculo: produto_id -> empresas ativas
    const produtoIds = Array.from(new Set(dataRows.map(l => l.produto_id).filter((v): v is number => v !== null)))
    const prodMap = new Map<number, Set<string>>()
    for (const part of chunk(produtoIds, 300)) {
      const { data, error } = await supabase.from('empresas_produtos')
        .select('produto_id, empresa_id').in('produto_id', part).eq('ativo', true).limit(10000)
      if (error) throw new Error('Erro ao consultar empresas_produtos: ' + error.message)
      for (const r of (data as any[]) ?? []) {
        if (!prodMap.has(r.produto_id)) prodMap.set(r.produto_id, new Set())
        prodMap.get(r.produto_id)!.add(r.empresa_id)
      }
    }

    // Existentes dos parceiros presentes no arquivo (para "novas" e "quitados")
    const parceiros = Array.from(new Set(dataRows.map(l => l.parceiro_planilha).filter((v): v is string => !!v)))
    const existentes: { id: string; key: string; situacao: string }[] = []
    for (const part of chunk(parceiros, 100)) {
      const { data, error } = await supabase.from('inadimplencias')
        .select('id, id_produto_raw, vencimento, valor, situacao, parceiro_planilha')
        .in('parceiro_planilha', part).limit(20000)
      if (error) throw new Error('Erro ao consultar inadimplências existentes: ' + error.message)
      for (const r of (data as any[]) ?? []) {
        existentes.push({ id: r.id, situacao: r.situacao, key: chaveUnica(r) })
      }
    }
    const existentesByKey = new Map(existentes.map(e => [e.key, e]))
    const fileKeys = new Set(dataRows.map(chaveUnica))

    // Monta a prévia por linha
    const rows: RowPrep[] = dataRows.map(linha => {
      let empresa_id: string | null = null
      let motivo: string | null = null
      if (linha.produto_id === null) motivo = 'nao_encontrado'
      else {
        const set = prodMap.get(linha.produto_id)
        if (!set || set.size === 0) motivo = 'nao_encontrado'
        else if (set.size > 1) motivo = 'ambiguo'
        else empresa_id = Array.from(set)[0]
      }
      return { linha, empresa_id, motivo, nova: !existentesByKey.has(chaveUnica(linha)) }
    })

    // Quitados: em_aberto existentes cujos parceiros estão no arquivo e a chave
    // não veio nesta importação.
    const quitadosIds = existentes
      .filter(e => e.situacao === 'em_aberto' && !fileKeys.has(e.key))
      .map(e => e.id)

    // Mês de referência predominante
    const contagem = new Map<string, number>()
    for (const l of dataRows) if (l.mes_referencia) contagem.set(l.mes_referencia, (contagem.get(l.mes_referencia) ?? 0) + 1)
    const mesRef = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    setPreview({
      mesRef,
      rows,
      totalLinhas: rows.length,
      totalVinculadas: rows.filter(r => r.empresa_id).length,
      totalPendentes: rows.filter(r => r.motivo).length,
      totalNovas: rows.filter(r => r.nova).length,
      quitadosIds,
      reconhecidas: hmap.reconhecidas,
      ignoradas: hmap.ignoradas,
    })
  }

  async function gravar() {
    if (!preview) return
    setSalvando(true); setErro('')
    try {
      const agora = new Date().toISOString()

      // Usuário logado (users_profile.id)
      let importadoPor: string | null = null
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const { data } = await supabase.from('users_profile').select('id').eq('email', user.email).maybeSingle()
        importadoPor = (data as any)?.id ?? null
      }

      // Registro da importação (primeiro, para vincular pendências)
      const { data: imp, error: impErr } = await supabase.from('inadimplencia_importacoes').insert({
        mes_referencia: preview.mesRef,
        arquivo_nome: fileName,
        total_linhas: preview.totalLinhas,
        total_vinculadas: preview.totalVinculadas,
        total_pendentes: preview.totalPendentes,
        importado_por: importadoPor,
        importado_em: agora,
      }).select('id').single()
      if (impErr) throw new Error('Erro ao registrar a importação: ' + impErr.message)
      const importacaoId = (imp as any).id

      // Preserva primeira_deteccao dos existentes
      const parceiros = Array.from(new Set(preview.rows.map(r => r.linha.parceiro_planilha).filter((v): v is string => !!v)))
      const primeiraByKey = new Map<string, string>()
      for (const part of chunk(parceiros, 100)) {
        const { data } = await supabase.from('inadimplencias')
          .select('id_produto_raw, vencimento, valor, primeira_deteccao')
          .in('parceiro_planilha', part).limit(20000)
        for (const r of (data as any[]) ?? []) primeiraByKey.set(chaveUnica(r), r.primeira_deteccao ?? agora)
      }

      // Upsert das linhas (novas + atualização das existentes) pela chave única
      const payload = preview.rows.map(r => {
        const l = r.linha
        const key = chaveUnica(l)
        return {
          id_produto_raw: l.id_produto_raw,
          produto_id: l.produto_id,
          sufixo: l.sufixo,
          vencimento: l.vencimento,
          valor: l.valor,
          cod_boleto: l.cod_boleto,
          mes_referencia: l.mes_referencia,
          razao_social_planilha: l.razao_social_planilha,
          parceiro_planilha: l.parceiro_planilha,
          tipo: l.tipo,
          banco: l.banco,
          situacao_cadastro: l.situacao_cadastro,
          status_bloqueio: l.status_bloqueio,
          status_cartorio: l.status_cartorio,
          data_liquidacao: l.data_liquidacao,
          pagamento_com_juros: l.pagamento_com_juros,
          empresa_id: r.empresa_id,
          situacao: 'em_aberto',
          quitado_em: null,
          primeira_deteccao: primeiraByKey.get(key) ?? agora,
          ultima_deteccao: agora,
          atualizado_em: agora,
        }
      })
      // Dedup por chave única dentro do próprio arquivo (mantém a última
      // ocorrência) — o upsert não pode afetar a mesma linha duas vezes no lote.
      const porChave = new Map<string, typeof payload[number]>()
      for (const p of payload) porChave.set(chaveUnica(p), p)
      const payloadUnico = Array.from(porChave.values())
      for (const part of chunk(payloadUnico, 500)) {
        const { error } = await supabase.from('inadimplencias')
          .upsert(part, { onConflict: 'id_produto_raw,vencimento,valor' })
        if (error) throw new Error('Erro ao gravar as inadimplências: ' + error.message)
      }

      // Pendências (linhas sem vínculo ou ambíguas)
      const pend = preview.rows.filter(r => r.motivo).map(r => ({
        importacao_id: importacaoId,
        id_produto_raw: r.linha.id_produto_raw,
        razao_social_planilha: r.linha.razao_social_planilha,
        vencimento: r.linha.vencimento,
        valor: r.linha.valor,
        motivo: MOTIVO_PENDENCIA[r.motivo!] ?? r.motivo,
        resolvida: false,
        criado_em: agora,
      }))
      for (const part of chunk(pend, 500)) {
        const { error } = await supabase.from('inadimplencia_pendencias').insert(part)
        if (error) throw new Error('Erro ao gravar pendências: ' + error.message)
      }

      // Quitação dos que não vieram nesta importação
      for (const part of chunk(preview.quitadosIds, 300)) {
        const { error } = await supabase.from('inadimplencias')
          .update({ situacao: 'quitado', quitado_em: agora, atualizado_em: agora }).in('id', part)
        if (error) throw new Error('Erro ao marcar quitados: ' + error.message)
      }

      setResultado({
        novas: preview.totalNovas,
        atualizadas: preview.totalLinhas - preview.totalNovas,
        pendentes: preview.totalPendentes,
        quitadas: preview.quitadosIds.length,
      })
      setPreview(null)
    } catch (err: any) {
      setErro(err?.message || 'Falha ao gravar a importação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/inadimplencia" className="btn btn-sm"><ArrowLeft size={14} /></Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Importar inadimplência</h1>
          <p className="text-xs text-gray-400 mt-0.5">Uso interno · atualização por planilha (.xlsx)</p>
        </div>
      </div>

      {/* Upload */}
      <div className="card">
        <div className="card-body">
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
          {!fileName ? (
            <button type="button" onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              <Upload size={28} />
              <span className="text-sm font-medium">Selecionar planilha (.xlsx)</span>
              <span className="text-xs">Colunas na ordem: Mês, RAZÃO SOCIAL, CÓD BOLETO, ID, TIPO, BANCO, VALOR, VENC., ...</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={22} className="text-[#185FA5] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800 truncate">{fileName}</div>
                <div className="text-xs text-gray-400">{analisando ? 'Analisando...' : preview ? 'Prévia pronta — confira antes de gravar.' : resultado ? 'Importação concluída.' : ''}</div>
              </div>
              <button type="button" onClick={reset} className="btn btn-sm"><X size={14} /> Trocar arquivo</button>
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> <span>{erro}</span>
        </div>
      )}

      {/* Prévia */}
      {preview && (
        <div className="mt-4 space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Prévia da importação</span>
              <span className="text-xs text-gray-400">Mês de referência: {fmtMes(preview.mesRef)}</span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Linhas" value={preview.totalLinhas} />
                <Stat label="Vinculadas" value={preview.totalVinculadas} tone="ok" />
                <Stat label="Pendentes" value={preview.totalPendentes} tone={preview.totalPendentes ? 'warn' : undefined} />
                <Stat label="Novas" value={preview.totalNovas} />
                <Stat label="Serão quitadas" value={preview.quitadosIds.length} tone="ok" />
              </div>

              {preview.totalPendentes > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                  {preview.totalPendentes} linha(s) sem vínculo automático entrarão na base assim mesmo (empresa em branco) e ficarão registradas como pendência para resolução manual.
                </p>
              )}

              {/* Colunas reconhecidas / ignoradas — para perceber mudança de layout */}
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Columns3 size={14} className="text-gray-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Colunas reconhecidas</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.reconhecidas.map(rec => (
                    <span key={rec.campo} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
                      <span className="font-medium text-gray-700">{rec.header}</span>
                      <span className="text-gray-400">→ {CAMPO_LABEL[rec.campo]}</span>
                    </span>
                  ))}
                </div>
                {preview.ignoradas.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Ignoradas ({preview.ignoradas.length}):</span>{' '}
                    {preview.ignoradas.join(', ')}
                    <div className="text-gray-400 mt-0.5">Colunas do arquivo sem campo correspondente. Se algo importante ficou de fora, o layout da planilha pode ter mudado — confira antes de gravar.</div>
                  </div>
                )}
              </div>

              <div className="mt-4 border border-gray-100 rounded-xl overflow-hidden">
                <div className="table-header grid text-xs" style={{ gridTemplateColumns: '90px 1fr 130px 90px 110px 120px' }}>
                  <span>ID</span><span>Razão social</span><span>Parceiro</span><span>Venc.</span><span>Valor</span><span>Vínculo</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {preview.rows.slice(0, 200).map((r, i) => (
                    <div key={i} className="table-row grid text-xs" style={{ gridTemplateColumns: '90px 1fr 130px 90px 110px 120px' }}>
                      <span className="font-mono text-gray-600 self-center">{r.linha.id_produto_raw || '—'}</span>
                      <span className="text-gray-700 self-center truncate">{r.linha.razao_social_planilha || '—'}</span>
                      <span className="text-gray-500 self-center truncate">{r.linha.parceiro_planilha || '—'}</span>
                      <span className="text-gray-500 self-center">{fmtDateBR(r.linha.vencimento)}</span>
                      <span className="text-gray-700 self-center">{fmtBRL(r.linha.valor)}</span>
                      <span className="self-center">
                        {r.empresa_id
                          ? <span className="badge bg-green-100 text-green-800 border border-green-300">Vinculada</span>
                          : <span className="badge bg-amber-50 text-amber-700 border border-amber-200">{MOTIVO_PENDENCIA[r.motivo ?? ''] ?? 'pendente'}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                {preview.rows.length > 200 && (
                  <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Mostrando as primeiras 200 de {preview.rows.length} linhas.</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button onClick={gravar} disabled={salvando} className="btn-primary disabled:opacity-50">
                  {salvando ? 'Gravando...' : 'Confirmar e gravar importação'}
                </button>
                <button onClick={reset} disabled={salvando} className="btn">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="mt-4 card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-green-700 mb-3">
              <CheckCircle2 size={18} /> <span className="font-medium">Importação concluída</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Novas" value={resultado.novas} />
              <Stat label="Atualizadas" value={resultado.atualizadas} />
              <Stat label="Pendências" value={resultado.pendentes} tone={resultado.pendentes ? 'warn' : undefined} />
              <Stat label="Quitadas" value={resultado.quitadas} tone="ok" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Link href="/inadimplencia" className="btn-primary">Ver inadimplências</Link>
              <Link href="/inadimplencia/importacoes" className="btn">Histórico de importações</Link>
              <button onClick={reset} className="btn">Nova importação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-900'
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}
