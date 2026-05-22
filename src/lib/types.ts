export type UserRole =
  | 'gestor_master'
  | 'supervisor_adm'
  | 'atendimento'
  | 'parceiro'
  | 'empresa_cliente'

export type CompanyStatus = 'ativa' | 'inativa' | 'bloqueada'

export type TicketStatus =
  | 'aberto'
  | 'em_analise'
  | 'encaminhado'
  | 'em_andamento'
  | 'aguardando_retorno'
  | 'finalizado'
  | 'cancelado'

export type TicketPriority = 'baixa' | 'media' | 'alta'

export type TicketType =
  | 'segunda_via_cartao'
  | 'inclusao_colaborador'
  | 'exclusao_colaborador'
  | 'alteracao_cadastro'
  | 'problema_saldo'
  | 'problema_cartao'
  | 'outros'

export type TicketDepartment =
  | 'cadastro'
  | 'financeiro'
  | 'operacional'
  | 'rede'
  | 'comercial'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: UserRole
  partner_id: string | null
  active: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Partner {
  id: string
  name: string
  email: string | null
  phone: string | null
  active: boolean
  created_at: string
}

export interface Company {
  id: string
  legal_name: string
  trade_name: string | null
  cnpj: string
  city: string
  state: string
  contact_name: string
  contact_phone: string | null
  contact_email: string | null
  partner_id: string | null
  status: CompanyStatus
  notes: string | null
  created_at: string
  updated_at: string
  partner?: Partner
}

export interface Ticket {
  id: string
  protocol: string
  company_id: string
  requester_name: string
  employee_name: string | null
  type: TicketType
  description: string
  department: TicketDepartment
  status: TicketStatus
  priority: TicketPriority
  assigned_to: string | null
  created_by: string
  first_response_at: string | null
  sla_deadline: string | null
  closed_at: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
}

export interface TicketWithDetails extends Ticket {
  company_legal_name: string
  company_trade_name: string | null
  company_cnpj: string
  company_city: string
  company_state: string
  partner_name: string | null
  assigned_to_name: string | null
  created_by_name: string
  sla_breached: boolean
  open_seconds: number
}

export interface TicketHistory {
  id: string
  ticket_id: string
  action: string
  observation: string | null
  from_status: TicketStatus | null
  to_status: TicketStatus | null
  user_id: string
  created_at: string
  user?: UserProfile
}

export interface DashboardSummary {
  opened_today: number
  open_total: number
  status_aberto: number
  status_em_analise: number
  status_em_andamento: number
  status_aguardando: number
  closed_month: number
  sla_breached: number
  avg_resolution_hours_week: number | null
}

