'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts'
import { Download, Search } from 'lucide-react'

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

const TYPE_LABELS: Record<string, string> = {
  segunda_via_cartao: 'Segunda via cartao', inclusao_colaborador: 'Inclusao colaborador',
  exclusao_colaborador: 'Exclusao colaborador', alteracao_cadastro: 'Alteracao cadastro',
  problema_saldo: 'Problema saldo', problema_cartao: 'Problema cartao', outros: 'Outros',
}

const COLORS = ['#185FA5','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#F97316']

const TABS = ['Visao Geral', 'Empresas', 'Tipos de Solicitacao', 'Departamentos', 'Detalhado']

interface Ticket {
  id: string; protocol: string; status: string; priority: string
  department: string; type: string; company_legal_name: string
  company_id: string; partner_name: string; open_seconds: number
  created_at: string; closed_at: string | null; sla_breached: boolean
}

export default function RelatoriosPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [tab, setTab] = useState('Visao Geral')
  const [companySearch, setCompanySearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - parseInt(period))
      const { data } = await supabase
        .from('tickets_with_details').select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
      setTickets((data as Ticket[]) ?? [])
      setLoading(false)
    }
    load()
  }, [period])

  // Metricas gerais
  const total      = tickets.length
  const finalizados = tickets.filter(t => t.status === 'finalizado').length
  const cancelados  = tickets.filter(t => t.status === 'cancelado').length
  const emAberto    = tickets.filter(t => !['finalizado','cancelado','rascunho'].includes(t.status)).length
  const slaVencidos = tickets.filter(t => t.sla_breached).length
  const tempoMedio  = tickets.filter(t => t.status === 'finalizado' && t.open_seconds > 0)
  const avgHours    = tempoMedio.length > 0
    ? (tempoMedio.reduce((s,t) => s + t.open_seconds, 0) / tempoMedio.length / 3600).toFixed(1)
    : '—'

  // Por departamento
  const byDept = useMemo(() => Object.entries(
    tickets.reduce((acc: Record<string,number>, t) => { acc[t.department] = (acc[t.department]??0)+1; return acc }, {})
  ).map(([d,c]) => ({ dept: DEPT_LABELS[d]??d, count: c, finalizados: tickets.filter(t=>t.department===d&&t.status==='finalizado').length }))
    .sort((a,b) => b.count-a.count), [tickets])

  // Por tipo de solicitacao
  const byType = useMemo(() => Object.entries(
    tickets.reduce((acc: Record<string,number>, t) => { acc[t.type] = (acc[t.type]??0)+1; return acc }, {})
  ).map(([type,count]) => ({ name: TYPE_LABELS[type]??type, value: count, type }))
    .sort((a,b) => b.value-a.value), [tickets])

  // Por empresa (completo)
  const byCompany = useMemo(() => {
    const map: Record<string, { name: string; total: number; finalizados: number; emAberto: number; slaVencidos: number; parceiro: string }> = {}
    tickets.forEach(t => {
      const name = t.company_legal_name ?? 'Sem empresa'
      if (!map[name]) map[name] = { name, total: 0, finalizados: 0, emAberto: 0, slaVencidos: 0, parceiro: t.partner_name ?? '—' }
      map[name].total++
      if (t.status === 'finalizado') map[name].finalizados++
      if (!['finalizado','cancelado','rascunho'].includes(t.status)) map[name].emAberto++
      if (t.sla_breached) map[name].slaVencidos++
    })
    return Object.values(map).sort((a,b) => b.total-a.total)
  }, [tickets])

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return byCompany
    const q = companySearch.toLowerCase()
    return byCompany.filter(c => c.name.toLowerCase().includes(q) || c.parceiro.toLowerCase().includes(q))
  }, [byCompany, companySearch])

  // Por status
  const byStatus = useMemo(() => Object.entries(
    tickets.reduce((acc: Record<string,number>, t) => { acc[t.status] = (acc[t.status]??0)+1; return acc }, {})
  ).map(([s,c]) => ({ name: STATUS_LABELS[s]??s, value: c })), [tickets])

  // Evolucao diaria (ultimos 14 dias)
  const dailyData = useMemo(() => {
    const days: Record<string,{date:string;abertos:number;finalizados:number}> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i)
      const key = d.toISOString().slice(0,10)
      days[key] = { date: key.slice(5), abertos: 0, finalizados: 0 }
    }
    tickets.forEach(t => {
      const key = t.created_at.slice(0,10)
      if (days[key]) days[key].abertos++
      if (t.closed_at) {
        const k2 = t.closed_at.slice(0,10)
        if (days[k2]) days[k2].finalizados++
      }
    })
    return Object.values(days)
  }, [tickets])

  function exportCSV() {
    const rows = [
      ['Protocolo','Empresa','Parceiro','Tipo','Departamento','Prioridade','Status','Aberto em','Fechado em'],
      ...tickets.map(t => [
        t.protocol, t.company_legal_name, t.partner_name??'',
        TYPE_LABELS[t.type]??t.type, DEPT_LABELS[t.department]??t.department,
        t.priority, STATUS_LABELS[t.status]??t.status,
        new Date(t.created_at).toLocaleDateString('pt-BR'),
        t.closed_at ? new Date(t.closed_at).toLocaleDateString('pt-BR') : '',
      ])
    ]
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `relatorio_vegas_${period}d_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Relatorios</h1>
          <p className="text-xs text-gray-400 mt-0.5">Analise operacional — {total} atendimentos</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="select w-44" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="7">Ultimos 7 dias</option>
            <option value="15">Ultimos 15 dias</option>
            <option value="30">Ultimos 30 dias</option>
            <option value="90">Ultimos 90 dias</option>
            <option value="365">Ultimo ano</option>
          </select>
          <button onClick={exportCSV} className="btn">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Metricas */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total',       value: total,      cls: 'text-gray-900' },
          { label: 'Em aberto',   value: emAberto,   cls: 'text-blue-600' },
          { label: 'Finalizados', value: finalizados, cls: 'text-green-600' },
          { label: 'Cancelados',  value: cancelados,  cls: 'text-gray-500' },
          { label: 'SLA vencido', value: slaVencidos, cls: 'text-red-600' },
          { label: 'Tempo medio', value: avgHours + (avgHours !== '—' ? 'h' : ''), cls: 'text-purple-600' },
        ].map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className={'metric-value ' + m.cls}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* VISAO GERAL */}
          {tab === 'Visao Geral' && (
            <div className="grid grid-cols-2 gap-5">
              {/* Evolucao diaria */}
              <div className="card col-span-2">
                <div className="card-header"><span className="card-title">Evolucao diaria (ultimos 14 dias)</span></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="abertos" stroke="#185FA5" name="Abertos" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="finalizados" stroke="#10B981" name="Finalizados" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status */}
              <div className="card">
                <div className="card-header"><span className="card-title">Por status</span></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={byStatus} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name"
                        label={({ name, percent }) => percent > 0.05 ? name + ' ' + (percent*100).toFixed(0) + '%' : ''}
                        labelLine={false} fontSize={10}>
                        {byStatus.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Prioridade */}
              <div className="card">
                <div className="card-header"><span className="card-title">Por prioridade</span></div>
                <div className="card-body space-y-4 pt-4">
                  {[
                    { label: 'Alta',  count: tickets.filter(t=>t.priority==='alta').length,  color: '#EF4444' },
                    { label: 'Media', count: tickets.filter(t=>t.priority==='media').length, color: '#F59E0B' },
                    { label: 'Baixa', count: tickets.filter(t=>t.priority==='baixa').length, color: '#10B981' },
                  ].map(p => (
                    <div key={p.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{p.label}</span>
                        <span className="font-medium">{p.count} ({total > 0 ? (p.count/total*100).toFixed(0) : 0}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: total > 0 ? (p.count/total*100)+'%' : '0%', background: p.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EMPRESAS */}
          {tab === 'Empresas' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative max-w-xs flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9" placeholder="Buscar empresa ou parceiro..."
                    value={companySearch} onChange={e => setCompanySearch(e.target.value)} />
                </div>
                <span className="text-xs text-gray-400">{filteredCompanies.length} empresas</span>
              </div>

              {/* Grafico top 10 */}
              <div className="card">
                <div className="card-header"><span className="card-title">Top 10 empresas por volume</span></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={byCompany.slice(0,10).map(c => ({ ...c, nome: c.name.length > 18 ? c.name.slice(0,18)+'...' : c.name }))}
                      layout="vertical" margin={{ top:0, right:40, left:10, bottom:0 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip formatter={(v: number) => [v, 'Atendimentos']} />
                      <Bar dataKey="total" fill="#185FA5" radius={[0,4,4,0]} name="Total" />
                      <Bar dataKey="finalizados" fill="#10B981" radius={[0,4,4,0]} name="Finalizados" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela completa */}
              <div className="card">
                <div className="table-header grid" style={{ gridTemplateColumns: '1fr 120px 80px 80px 80px 80px' }}>
                  <span>Empresa</span><span>Parceiro</span><span>Total</span><span>Em aberto</span><span>Finalizados</span><span>SLA vencido</span>
                </div>
                {filteredCompanies.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">Nenhuma empresa encontrada</div>
                ) : filteredCompanies.map((c, i) => (
                  <div key={i} className="table-row grid" style={{ gridTemplateColumns: '1fr 120px 80px 80px 80px 80px' }}>
                    <div>
                      <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                    </div>
                    <span className="text-xs text-gray-500 truncate">{c.parceiro}</span>
                    <span className="text-sm font-semibold text-gray-900">{c.total}</span>
                    <span className={`text-sm font-medium ${c.emAberto > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{c.emAberto}</span>
                    <span className={`text-sm font-medium ${c.finalizados > 0 ? 'text-green-600' : 'text-gray-400'}`}>{c.finalizados}</span>
                    <span className={`text-sm font-medium ${c.slaVencidos > 0 ? 'text-red-600' : 'text-gray-400'}`}>{c.slaVencidos}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIPOS DE SOLICITACAO */}
          {tab === 'Tipos de Solicitacao' && (
            <div className="grid grid-cols-2 gap-5">
              {/* Pizza */}
              <div className="card">
                <div className="card-header"><span className="card-title">Distribuicao por tipo</span></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={byType} cx="50%" cy="45%" outerRadius={90} dataKey="value" nameKey="name"
                        label={({ name, percent }) => percent > 0.05 ? (percent*100).toFixed(0)+'%' : ''}
                        labelLine={false} fontSize={11}>
                        {byType.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v:number, n:string) => [v + ' atendimentos', n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Barras */}
              <div className="card">
                <div className="card-header"><span className="card-title">Volume por tipo</span></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byType} layout="vertical" margin={{ top:0, right:40, left:10, bottom:0 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0,4,4,0]} name="Atendimentos">
                        {byType.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela tipos */}
              <div className="card col-span-2">
                <div className="table-header grid" style={{ gridTemplateColumns: '1fr 100px 100px 100px 120px' }}>
                  <span>Tipo de solicitacao</span><span>Total</span><span>Finalizados</span><span>Em aberto</span><span>% do total</span>
                </div>
                {byType.map((t, i) => {
                  const fins = tickets.filter(tk => tk.type === t.type && tk.status === 'finalizado').length
                  const abts = tickets.filter(tk => tk.type === t.type && !['finalizado','cancelado','rascunho'].includes(tk.status)).length
                  return (
                    <div key={i} className="table-row grid" style={{ gridTemplateColumns: '1fr 100px 100px 100px 120px' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i%COLORS.length] }} />
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{t.value}</span>
                      <span className="text-sm text-green-600">{fins}</span>
                      <span className="text-sm text-blue-600">{abts}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: total > 0 ? (t.value/total*100)+'%' : '0%', background: COLORS[i%COLORS.length] }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{total > 0 ? (t.value/total*100).toFixed(0) : 0}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DEPARTAMENTOS */}
          {tab === 'Departamentos' && (
            <div className="space-y-5">
              <div className="card">
                <div className="card-header"><span className="card-title">Atendimentos por departamento</span></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={byDept} margin={{ top:0, right:20, left:-20, bottom:30 }}>
                      <XAxis dataKey="dept" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#185FA5" radius={[4,4,0,0]} name="Total" />
                      <Bar dataKey="finalizados" fill="#10B981" radius={[4,4,0,0]} name="Finalizados" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="table-header grid" style={{ gridTemplateColumns: '1fr 100px 100px 100px 120px' }}>
                  <span>Departamento</span><span>Total</span><span>Finalizados</span><span>Em aberto</span><span>Taxa conclusao</span>
                </div>
                {byDept.map((d, i) => {
                  const abts = tickets.filter(t => t.department === Object.keys(DEPT_LABELS).find(k => DEPT_LABELS[k] === d.dept) && !['finalizado','cancelado','rascunho'].includes(t.status)).length
                  const taxa = d.count > 0 ? (d.finalizados/d.count*100).toFixed(0) : '0'
                  return (
                    <div key={i} className="table-row grid" style={{ gridTemplateColumns: '1fr 100px 100px 100px 120px' }}>
                      <span className="text-sm font-medium text-gray-900">{d.dept}</span>
                      <span className="text-sm font-semibold text-gray-900">{d.count}</span>
                      <span className="text-sm text-green-600">{d.finalizados}</span>
                      <span className="text-sm text-blue-600">{abts}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: taxa + '%' }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{taxa}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DETALHADO */}
          {tab === 'Detalhado' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Lista completa</span>
                <button onClick={exportCSV} className="btn btn-sm text-xs"><Download size={12} /> CSV</button>
              </div>
              <div className="table-header grid text-xs" style={{ gridTemplateColumns: '120px 1fr 110px 80px 130px 80px' }}>
                <span>Protocolo</span><span>Empresa</span><span>Depto</span><span>Prioridade</span><span>Status</span><span>Data</span>
              </div>
              {tickets.map(t => (
                <div key={t.id} className="table-row grid text-xs" style={{ gridTemplateColumns: '120px 1fr 110px 80px 130px 80px' }}>
                  <span className="font-mono text-gray-400">{t.protocol}</span>
                  <span className="truncate text-gray-900 font-medium">{t.company_legal_name ?? 'Sem empresa'}</span>
                  <span className="text-gray-500">{DEPT_LABELS[t.department]??t.department}</span>
                  <span className={t.priority==='alta' ? 'text-red-600' : t.priority==='media' ? 'text-amber-600' : 'text-green-600'}>
                    {t.priority==='alta' ? 'Alta' : t.priority==='media' ? 'Media' : 'Baixa'}
                  </span>
                  <span className="text-gray-600">{STATUS_LABELS[t.status]??t.status}</span>
                  <span className="text-gray-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
