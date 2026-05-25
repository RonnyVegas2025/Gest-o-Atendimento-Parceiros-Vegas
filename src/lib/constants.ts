import type { TicketStatus, TicketPriority, TicketType, TicketDepartment, CompanyStatus } from './types'

export const STATUS_LABELS: Record<TicketStatus, string> = {
  rascunho:           'Rascunho',
  aberto:             'Aberto',
  em_analise:         'Em análise',
  encaminhado:        'Encaminhado',
  em_andamento:       'Em andamento',
  aguardando_retorno: 'Aguardando retorno',
  finalizado:         'Finalizado',
  cancelado:          'Cancelado',
}

export const STATUS_COLORS: Record<TicketStatus, string> = {
  rascunho:           'bg-amber-50 text-amber-600 border border-amber-200',
  aberto:             'bg-blue-50 text-blue-700 border border-blue-200',
  em_analise:         'bg-amber-50 text-amber-700 border border-amber-200',
  encaminhado:        'bg-purple-50 text-purple-700 border border-purple-200',
  em_andamento:       'bg-green-50 text-green-700 border border-green-200',
  aguardando_retorno: 'bg-gray-100 text-gray-600 border border-gray-200',
  finalizado:         'bg-green-100 text-green-800 border border-green-300',
  cancelado:          'bg-red-50 text-red-700 border border-red-200',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta:  'Alta',
}

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  baixa: 'bg-green-500',
  media: 'bg-amber-400',
  alta:  'bg-red-500',
}

export const TYPE_LABELS: Record<TicketType, string> = {
  segunda_via_cartao:    'Segunda via cartão',
  inclusao_colaborador:  'Inclusão colaborador',
  exclusao_colaborador:  'Exclusão colaborador',
  alteracao_cadastro:    'Alteração cadastro',
  problema_saldo:        'Problema saldo',
  problema_cartao:       'Problema cartão',
  outros:                'Outros',
}

export const DEPARTMENT_LABELS: Record<TicketDepartment, string> = {
  cadastro:    'Cadastro',
  financeiro:  'Financeiro',
  operacional: 'Operacional',
  rede:        'Rede',
  comercial:   'Comercial',
}

export const COMPANY_STATUS_COLORS: Record<CompanyStatus, string> = {
  ativa:     'bg-green-50 text-green-700 border border-green-200',
  inativa:   'bg-gray-100 text-gray-600 border border-gray-200',
  bloqueada: 'bg-red-50 text-red-700 border border-red-200',
}

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  ativa:     'Ativa',
  inativa:   'Inativa',
  bloqueada: 'Bloqueada',
}

export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  rascunho:           ['aberto', 'cancelado'],
  aberto:             ['em_analise', 'cancelado'],
  em_analise:         ['encaminhado', 'em_andamento', 'aguardando_retorno', 'cancelado'],
  encaminhado:        ['em_andamento', 'aguardando_retorno'],
  em_andamento:       ['aguardando_retorno', 'finalizado', 'cancelado'],
  aguardando_retorno: ['em_andamento', 'cancelado'],
  finalizado:         [],
  cancelado:          [],
}

export const SLA_HOURS: Record<TicketPriority, number> = {
  alta:  4,
  media: 8,
  baixa: 24,
}
