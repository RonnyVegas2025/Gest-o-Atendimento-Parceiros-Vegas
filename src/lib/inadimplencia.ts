/*
 * Controle de inadimplência — helpers de normalização, parsing da planilha e
 * rótulos. Uso interno (time Vegas). Sem dependência de UI.
 *
 * Tabelas (já existentes no Supabase, não criar/alterar):
 * - inadimplencia_importacoes, inadimplencias, inadimplencia_pendencias.
 *
 * A planilha (.xlsx) tem as colunas, nesta ordem:
 *   Mês | RAZÃO SOCIAL | CÓD BOLETO | ID | TIPO | BANCO | VALOR | VENC. |
 *   ATIVO/INATIVO | STATUS - BLOQUEIO | STATUS - CARTÓRIO | Data de Liquidação |
 *   Pagamento realizado com Juros | Dias Em Aberto | Data Bol Prorrogado |
 *   Juros ao mês | Mora diária | Parceiro
 * As 4 penúltimas (Dias Em Aberto, Data Bol Prorrogado, Juros ao mês, Mora
 * diária) são ignoradas — vêm vazias e são calculadas pelo sistema.
 */

// ————————————————————————————————————————————————————————————————
// Rótulos e cores (situação do ciclo de vida — não confundir com ATIVO/INATIVO
// do cadastro, que vai para situacao_cadastro).
// ————————————————————————————————————————————————————————————————
export const SITUACAO_INADIMPLENCIA: Record<string, { label: string; badge: string }> = {
  em_aberto: { label: 'Em aberto', badge: 'bg-red-50 text-red-700 border border-red-200' },
  quitado:   { label: 'Quitado',   badge: 'bg-green-100 text-green-800 border border-green-300' },
}

export const MOTIVO_PENDENCIA: Record<string, string> = {
  nao_encontrado: 'produto não encontrado',
  ambiguo:        'produto ambíguo',
}

// ————————————————————————————————————————————————————————————————
// Normalização de texto
// ————————————————————————————————————————————————————————————————
/** Remove espaços comuns e non-breaking spaces ( ) das pontas. */
export function cleanText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/ /g, ' ').trim()
}

/** Normaliza para comparação (sem acento, minúsculo, espaços colapsados). */
export function normKey(v: unknown): string {
  return cleanText(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

// ————————————————————————————————————————————————————————————————
// Parsing de valores
// ————————————————————————————————————————————————————————————————
/** Número em formato BR ("1.234,56") ou nativo. Retorna null se vazio/inválido. */
export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = cleanText(v).replace(/r\$/i, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function pad(n: number): string { return String(n).padStart(2, '0') }

/** Data (Date do xlsx, ou string DD/MM/AAAA ou AAAA-MM-DD) → 'AAAA-MM-DD' | null. */
export function parseDateISO(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  const s = cleanText(v)
  if (!s || s === '-') return null
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) {
    const yy = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${yy}-${pad(+m[2])}-${pad(+m[1])}`
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const MESES_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

/** Mês de referência → 'AAAA-MM-01' (primeiro dia do mês) | null. */
export function parseMonthISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-01`
  }
  const s = cleanText(v)
  if (!s) return null
  let m = s.match(/^(\d{4})[-/](\d{1,2})/)                 // 2026-09 | 2026/9
  if (m) return `${m[1]}-${pad(+m[2])}-01`
  m = s.match(/^(\d{1,2})[-/](\d{4})$/)                    // 09/2026
  if (m) return `${m[2]}-${pad(+m[1])}-01`
  m = s.match(/^([a-zç]{3})[a-zç]*[.\/-]?\s*(\d{2,4})$/i)   // set/26 | setembro 2026
  if (m) {
    const mes = MESES_PT[normKey(m[1]).slice(0, 3)]
    if (mes) { const yy = m[2].length === 2 ? '20' + m[2] : m[2]; return `${yy}-${pad(mes)}-01` }
  }
  const iso = parseDateISO(s)
  return iso ? iso.slice(0, 8) + '01' : null
}

/** "sim"/"não"/vazio → boolean | null. */
export function parseBoolJuros(v: unknown): boolean | null {
  const s = normKey(v)
  if (!s) return null
  if (['sim', 's', 'true', 'x'].includes(s)) return true
  if (['nao', 'n', 'false'].includes(s)) return false
  return null
}

/** CÓD BOLETO: "-" ou vazio → null. */
export function parseCodBoleto(v: unknown): string | null {
  const s = cleanText(v)
  return !s || s === '-' ? null : s
}

/**
 * ID do produto. Pode vir numérico (12009) ou com sufixo de letra (16195A).
 * Retorna o valor original (raw), a parte numérica (produto_id) e a letra (sufixo).
 */
export function extractProduto(v: unknown): { id_produto_raw: string; produto_id: number | null; sufixo: string | null } {
  const raw = cleanText(v)
  if (!raw) return { id_produto_raw: '', produto_id: null, sufixo: null }
  const num = raw.match(/\d+/)
  const letra = raw.match(/[A-Za-z]+/)
  return {
    id_produto_raw: raw,
    produto_id: num ? parseInt(num[0], 10) : null,
    sufixo: letra ? letra[0].toUpperCase() : null,
  }
}

// ————————————————————————————————————————————————————————————————
// Dias em aberto (calculado a partir do vencimento — nunca importado)
// ————————————————————————————————————————————————————————————————
export function diasEmAberto(vencimento: string | null, ref: Date = new Date()): number | null {
  if (!vencimento) return null
  const venc = new Date(vencimento.length <= 10 ? vencimento + 'T00:00:00' : vencimento)
  if (isNaN(venc.getTime())) return null
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const diff = Math.floor((base.getTime() - venc.getTime()) / 86400000)
  return Math.max(0, diff)
}

interface DiasRow { situacao: string; vencimento: string | null; quitado_em?: string | null }

/**
 * Dias em atraso, para qualquer situação:
 * - em aberto: dias entre o vencimento e HOJE (mínimo 0);
 * - quitado: dias entre o vencimento e quitado_em (assinado — negativo se pago
 *   antes do vencimento); null quando quitado_em está vazio.
 */
export function diasAtraso(r: DiasRow, ref: Date = new Date()): number | null {
  if (!r.vencimento) return null
  if (r.situacao === 'quitado') {
    if (!r.quitado_em) return null
    const venc = new Date(r.vencimento.length <= 10 ? r.vencimento + 'T00:00:00' : r.vencimento)
    const pago = new Date(String(r.quitado_em).slice(0, 10) + 'T00:00:00')
    if (isNaN(venc.getTime()) || isNaN(pago.getTime())) return null
    return Math.floor((pago.getTime() - venc.getTime()) / 86400000)
  }
  return diasEmAberto(r.vencimento, ref)
}

/** Rótulo de dias em atraso: "—" (sem dado), "no prazo" (≤ 0) ou "N dia(s)". */
export function labelDiasAtraso(r: DiasRow, ref: Date = new Date()): string {
  const d = diasAtraso(r, ref)
  if (d === null) return '—'
  if (d <= 0) return 'no prazo'
  return `${d} dia${d === 1 ? '' : 's'}`
}

// ————————————————————————————————————————————————————————————————
// Mapeamento de colunas da planilha
// ————————————————————————————————————————————————————————————————
/**
 * Aliases de cabeçalho por campo. O financeiro muda o layout da planilha com
 * frequência, então cada campo aceita VÁRIOS nomes. A comparação é por nome
 * NORMALIZADO (sem acento, sem  , sem espaços extras, case-insensitive) —
 * os aliases podem ser escritos aqui na forma humana.
 */
export const COLUNAS: Record<string, string[]> = {
  mes:            ['Mês', 'Mes'],
  razao_social:   ['Razão Social'],
  cod_boleto:     ['CÓD BOLETO', 'Código Boleto', 'NOSSO N°', 'NOSSO Nº', 'NOSSO NUMERO', 'Nosso Número'],
  id:             ['ID'],
  tipo:           ['Tipo'],
  banco:          ['Banco'],
  valor:          ['Valor'],
  vencimento:     ['Venc.', 'Venc', 'Vencimento'],
  ativo_inativo:  ['Ativo/Inativo', 'Ativo Inativo'],
  status_bloqueio:['STATUS - BLOQUEIO', 'Status Bloqueio', 'STATUS'],
  status_cartorio:['STATUS - CARTÓRIO', 'Status Cartório'],
  data_liquidacao:['Data de Liquidação', 'Data Liquidação', 'PAGO EM'],
  pagamento_juros:['Pagamento realizado com Juros'],
  parceiro:       ['Parceiro'],
}

export type ColunaKey = keyof typeof COLUNAS

/** Rótulo amigável de cada campo, para a prévia da importação. */
export const CAMPO_LABEL: Record<ColunaKey, string> = {
  mes: 'Mês de referência',
  razao_social: 'Razão social',
  cod_boleto: 'Cód. boleto',
  id: 'ID',
  tipo: 'Tipo',
  banco: 'Banco',
  valor: 'Valor',
  vencimento: 'Vencimento',
  ativo_inativo: 'Situação do cadastro',
  status_bloqueio: 'Status de bloqueio',
  status_cartorio: 'Status de cartório',
  data_liquidacao: 'Data de liquidação',
  pagamento_juros: 'Pagamento com juros',
  parceiro: 'Parceiro',
}

// Normaliza um rótulo para comparação (sem acento/nbsp/espaços extras, minúsculo
// e sem ponto final — "Venc." e "VENC" batem).
function normHeader(v: unknown): string { return normKey(v).replace(/\.$/, '') }

export interface HeaderMap {
  index: Partial<Record<ColunaKey, number>>
  faltando: ColunaKey[]
  /** Colunas do arquivo reconhecidas → campo do sistema. */
  reconhecidas: { campo: ColunaKey; header: string }[]
  /** Colunas do arquivo que não correspondem a nenhum campo (ignoradas). */
  ignoradas: string[]
}

/**
 * Constrói o índice coluna→posição a partir da linha de cabeçalho (array de
 * células), comparando nomes normalizados contra os aliases de cada campo.
 * Obrigatórias: Razão Social, ID, Valor, Venc. — as demais, se ausentes,
 * viram null (nunca rejeitam o arquivo).
 */
export function mapHeader(headerRow: unknown[]): HeaderMap {
  const normalized = headerRow.map(normHeader)
  const index: Partial<Record<ColunaKey, number>> = {}
  const usados = new Set<number>()
  for (const key of Object.keys(COLUNAS) as ColunaKey[]) {
    const alt = COLUNAS[key].map(normHeader)
    const pos = normalized.findIndex((h, i) => h !== '' && !usados.has(i) && alt.includes(h))
    if (pos >= 0) { index[key] = pos; usados.add(pos) }
  }
  const OBRIGATORIAS: ColunaKey[] = ['razao_social', 'id', 'valor', 'vencimento']
  const faltando = OBRIGATORIAS.filter(k => index[k] === undefined)

  const reconhecidas = (Object.keys(index) as ColunaKey[])
    .map(campo => ({ campo, header: cleanText(headerRow[index[campo] as number]) }))
  const ignoradas = headerRow
    .map((c, i) => ({ label: cleanText(c), i }))
    .filter(x => x.label !== '' && !usados.has(x.i))
    .map(x => x.label)

  return { index, faltando, reconhecidas, ignoradas }
}

/**
 * Normaliza o nome do parceiro para gravação: trim (inclui  ), MAIÚSCULAS
 * e sem acento — assim "Nex7" e "NEX7" viram o mesmo parceiro e a quitação
 * automática não trata como parceiros diferentes.
 */
export function normalizeParceiro(v: unknown): string | null {
  const s = cleanText(v)
  if (!s) return null
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

export interface LinhaNormalizada {
  mes_referencia: string | null
  razao_social_planilha: string | null
  cod_boleto: string | null
  id_produto_raw: string
  produto_id: number | null
  sufixo: string | null
  tipo: string | null
  banco: string | null
  valor: number | null
  vencimento: string | null
  situacao_cadastro: string | null
  status_bloqueio: string | null
  status_cartorio: string | null
  data_liquidacao: string | null
  pagamento_com_juros: boolean | null
  parceiro_planilha: string | null
}

/** Normaliza uma linha bruta (array de células) usando o índice de colunas. */
export function normalizeLinha(row: unknown[], idx: Partial<Record<ColunaKey, number>>): LinhaNormalizada {
  const get = (k: ColunaKey) => (idx[k] === undefined ? undefined : row[idx[k] as number])
  const prod = extractProduto(get('id'))
  const statusBloqueio = cleanText(get('status_bloqueio')) || null
  const dataLiquidacao = parseDateISO(get('data_liquidacao'))

  // Pagamento com juros: usa a coluna própria; mas quando há PAGO EM (data de
  // liquidação) preenchido, deriva também do texto da coluna STATUS
  // ("COM JUROS" → true, "SEM JUROS" → false; qualquer outro mantém o valor).
  let pagamentoComJuros = parseBoolJuros(get('pagamento_juros'))
  if (dataLiquidacao && statusBloqueio) {
    const s = normKey(statusBloqueio)
    if (s.includes('com juros')) pagamentoComJuros = true
    else if (s.includes('sem juros')) pagamentoComJuros = false
  }

  return {
    mes_referencia: parseMonthISO(get('mes')),
    razao_social_planilha: cleanText(get('razao_social')) || null,
    cod_boleto: parseCodBoleto(get('cod_boleto')),
    id_produto_raw: prod.id_produto_raw,
    produto_id: prod.produto_id,
    sufixo: prod.sufixo,
    tipo: cleanText(get('tipo')) || null,
    banco: cleanText(get('banco')) || null,
    valor: parseNum(get('valor')),
    vencimento: parseDateISO(get('vencimento')),
    situacao_cadastro: cleanText(get('ativo_inativo')) || null,
    status_bloqueio: statusBloqueio,
    status_cartorio: cleanText(get('status_cartorio')) || null,
    data_liquidacao: dataLiquidacao,
    pagamento_com_juros: pagamentoComJuros,
    parceiro_planilha: normalizeParceiro(get('parceiro')),
  }
}

/** Chave única da inadimplência: (id_produto_raw, vencimento, valor). */
export function chaveUnica(l: { id_produto_raw: string; vencimento: string | null; valor: number | null }): string {
  return `${l.id_produto_raw}||${l.vencimento ?? ''}||${l.valor ?? ''}`
}

/** Formata data ISO para pt-BR (dd/mm/aaaa). */
export function fmtDateBR(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR')
}

/** Formata mês de referência para "mmm/aaaa" (ex.: set/2026). */
export function fmtMes(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
}

/** Formata número como moeda BRL. */
export function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
