'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const DEPT_LABELS: Record<string, string> = {
  comercial: 'ADM Comercial', cadastro: 'Cadastro', financeiro: 'Financeiro',
  operacional: 'Operacional', rede: 'Rede', marketing: 'Marketing',
  juridico: 'Juridico', logistica: 'Logistica',
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', aberto: 'Aberto', em_analise: 'Em analise',
  encaminhado: 'Encaminhado', em_andamento: 'Em andamento',
  aguardando_retorno: 'Aguardando', finalizado: 'Finalizado', cancelado: 'Cancelado',
}

const COLORS = ['#185FA5', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#F97316']

interface Ticket {
  id: string
  protocol: string
  status: string
  priority: string
  department: string
  type: string
  company_legal_name: string
  partner_name: string
  open_seconds: number
  created_at: string
  closed_at: string | null
  sla_breached: boolean
}

export default function RelatoriosPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - parseInt(period))

      const { data } = await supabase
        .from('tickets_with_details')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })

      setTickets((data as Ticket[]) ?? [])
      setLoading(false)
    }
    load()
  }, [period])

  // Metricas gerais
  const total = tickets.length
  const finalizados = tickets.filter(t => t.status === 'finalizado').length
  const cancelados  = tickets.filter(t => t.status === 'cancelado').length
  const emAberto    = tickets.filter(t => !['finalizado', 'cancelado', 'rascunho'].includes(t.status)).length
  const slaVencidos = tickets.filter(t => t.sla_breached).length
  const tempoMedio  = tickets.filter(t => t.status === 'finalizado' && t.open_seconds > 0)
  const avgHours    = tempoMedio.length > 0
    ? (tempoMedio.reduce((s, t) => s + t.open_seconds, 0) / tempoMedio.length / 3600).toFixed(1)
    : '—'

  // Por departamento
  const byDept = Object.entries(
    tickets.reduce((acc: Record<string, number>, t) => {
      acc[t.department] = (acc[t.department] ?? 0) + 1
      return acc
    }, {})
  ).map(([dept, count]) => ({ dept: DEPT_LABELS[dept] ?? dept, count }))
    .sort((a, b) => b.count - a.count)

  // Por status
  const byStatus = Object.entries(
    tickets.reduce((acc: Record<string, number>, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    }, {})
  ).map(([status, count]) => ({ name: STATUS_LABELS[status] ?? status, value: count }))

  // Por prioridade
  const byPriority = [
    { name: 'Alta',  value: tickets.filter(t => t.priority === 'alta').length,  color: '#EF4444' },
    { name: 'Media', value: tickets.filter(t => t.priority === 'media').length, color: '#F59E0B' },
    { name: 'Baixa', value: tickets.filter(t => t.priority === 'baixa').length, color: '#10B981' },
  ]

  // Por empresa (top 8)
  const byCompany = Object.entries(
    tickets.reduce((acc: Record<string, number>, t) => {
      const name = t.company_legal_name ?? 'Sem empresa'
      acc[name] = (acc[name] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Por parceiro
  const byPartner = Object.entries(
    tickets.reduce((acc: Record<string, number>, t) => {
      const name = t.partner_name ?? 'Sem parceiro'
      acc[name] = (acc[name] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Relatorios</h1>
          <p className="text-xs text-gray-400 mt-0.5">Analise operacional dos atendimentos</p>
        </div>
        <select className="select w-44" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="7">Ultimos 7 dias</option>
          <option value="15">Ultimos 15 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="90">Ultimos 90 dias</option>
          <option value="365">Ultimo ano</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Carregando relatorios...</div>
      ) : (
        <>
          {/* Metricas */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: 'Total',        value: total,      color: 'text-gray-900' },
              { label: 'Em aberto',    value: emAberto,   color: 'text-blue-600' },
              { label: 'Finalizados',  value: finalizados,color: 'text-green-600' },
              { label: 'Cancelados',   value: cancelados, color: 'text-gray-500' },
              { label: 'SLA vencido',  value: slaVencidos,color: 'text-red-600' },
              { label: 'Tempo medio',  value: avgHours + (avgHours !== '—' ? 'h' : ''), color: 'text-purple-600' },
            ].map(m => (
              <div key={m.label} className="metric-card">
                <div className="metric-label">{m.label}</div>
                <div className={'metric-value ' + m.color}>{m.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Por departamento */}
            <div className="card">
              <div className="card-header"><span className="card-title">Por departamento</span></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byDept} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
                    <XAxis dataKey="dept" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#185FA5" radius={[4, 4, 0, 0]} name="Atendimentos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Por status */}
            <div className="card">
              <div className="card-header"><span className="card-title">Por status</span></div>
              <div className="card-body flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byStatus} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({ name, percent }) => name + ' ' + (percent * 100).toFixed(0) + '%'} labelLine={false} fontSize={10}>
                      {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Por empresa */}
            <div className="card">
              <div className="card-header"><span className="card-title">Top empresas</span></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byCompany} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} name="Atendimentos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Por prioridade + parceiro */}
            <div className="space-y-5">
              {/* Prioridade */}
              <div className="card">
                <div className="card-header"><span className="card-title">Por prioridade</span></div>
                <div className="card-body">
                  <div className="space-y-3">
                    {byPriority.map(p => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="w-12 text-xs text-gray-500">{p.name}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: total > 0 ? (p.value / total * 100) + '%' : '0%', background: p.color }} />
                        </div>
                        <span className="w-8 text-xs text-gray-500 text-right">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Por parceiro */}
              <div className="card">
                <div className="card-header"><span className="card-title">Por parceiro</span></div>
                <div className="card-body">
                  {byPartner.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum dado</p>
                  ) : (
                    <div className="space-y-2">
                      {byPartner.map(p => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate flex-1">{p.name}</span>
                          <span className="font-medium text-gray-900 ml-3">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabela detalhada */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Ultimos atendimentos</span>
              <span className="text-xs text-gray-400">{tickets.length} registros</span>
            </div>
            <div className="table-header grid text-xs" style={{ gridTemplateColumns: '120px 1fr 110px 80px 130px 80px' }}>
              <span>Protocolo</span><span>Empresa</span><span>Depto</span><span>Prioridade</span><span>Status</span><span>Abertura</span>
            </div>
            {tickets.slice(0, 20).map(t => (
              <div key={t.id} className="table-row grid text-xs" style={{ gridTemplateColumns: '120px 1fr 110px 80px 130px 80px' }}>
                <span className="font-mono text-gray-400">{t.protocol}</span>
                <span className="truncate text-gray-900 font-medium">{t.company_legal_name ?? 'Sem empresa'}</span>
                <span className="text-gray-500">{DEPT_LABELS[t.department] ?? t.department}</span>
                <span className={t.priority === 'alta' ? 'text-red-600' : t.priority === 'media' ? 'text-amber-600' : 'text-green-600'}>
                  {t.priority === 'alta' ? 'Alta' : t.priority === 'media' ? 'Media' : 'Baixa'}
                </span>
                <span className="text-gray-600">{STATUS_LABELS[t.status] ?? t.status}</span>
                <span className="text-gray-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
