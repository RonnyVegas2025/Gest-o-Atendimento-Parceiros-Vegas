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

// ————————————————————————————————————————————————————————————————
// Mapeamento de colunas da planilha
// ————————————————————————————————————————————————————————————————
/** Nome canônico de cada coluna usada (chave) → possíveis rótulos no arquivo. */
export const COLUNAS = {
  mes:            ['mes'],
  razao_social:   ['razao social'],
  cod_boleto:     ['cod boleto', 'codigo boleto'],
  id:             ['id'],
  tipo:           ['tipo'],
  banco:          ['banco'],
  valor:          ['valor'],
  vencimento:     ['venc', 'venc.', 'vencimento'],
  ativo_inativo:  ['ativo/inativo', 'ativo inativo'],
  status_bloqueio:['status - bloqueio', 'status bloqueio'],
  status_cartorio:['status - cartorio', 'status cartorio'],
  data_liquidacao:['data de liquidacao', 'data liquidacao'],
  pagamento_juros:['pagamento realizado com juros'],
  parceiro:       ['parceiro'],
} as const

export type ColunaKey = keyof typeof COLUNAS

/**
 * Constrói o índice coluna→posição a partir da linha de cabeçalho (array de
 * células). Retorna o mapa e a lista de colunas obrigatórias ausentes.
 */
export function mapHeader(headerRow: unknown[]): { index: Partial<Record<ColunaKey, number>>; faltando: ColunaKey[] } {
  const normalized = headerRow.map(c => normKey(c).replace(/\.$/, ''))
  const index: Partial<Record<ColunaKey, number>> = {}
  for (const key of Object.keys(COLUNAS) as ColunaKey[]) {
    const alt = COLUNAS[key].map(a => a.replace(/\.$/, ''))
    const pos = normalized.findIndex(h => alt.includes(h))
    if (pos >= 0) index[key] = pos
  }
  const OBRIGATORIAS: ColunaKey[] = ['id', 'valor', 'vencimento', 'parceiro']
  const faltando = OBRIGATORIAS.filter(k => index[k] === undefined)
  return { index, faltando }
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
    status_bloqueio: cleanText(get('status_bloqueio')) || null,
    status_cartorio: cleanText(get('status_cartorio')) || null,
    data_liquidacao: parseDateISO(get('data_liquidacao')),
    pagamento_com_juros: parseBoolJuros(get('pagamento_juros')),
    parceiro_planilha: cleanText(get('parceiro')) || null,
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
