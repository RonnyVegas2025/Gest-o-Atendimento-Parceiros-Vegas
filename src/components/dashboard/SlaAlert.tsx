'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SlaTicket {
  id: string
  protocol: string
  company_legal_name: string
  sla_deadline: string
  status: string
  department: string
  open_seconds: number
}

const DEPT_LABELS: Record<string, string> = {
  comercial: 'ADM Comercial', cadastro: 'Cadastro', financeiro: 'Financeiro',
  operacional: 'Operacional', rede: 'Rede', marketing: 'Marketing',
  juridico: 'Juridico', logistica: 'Logistica',
}

function timeRemaining(deadline: string): { text: string; urgent: boolean; overdue: boolean } {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff < 0) {
    const over = Math.abs(diff)
    const h = Math.floor(over / 3600000)
    const m = Math.floor((over % 3600000) / 60000)
    return { text: h > 0 ? h + 'h ' + m + 'min em atraso' : m + 'min em atraso', urgent: true, overdue: true }
  }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const urgent = diff < 2 * 3600000
  return { text: h > 0 ? h + 'h ' + m + 'min restantes' : m + 'min restantes', urgent, overdue: false }
}

export default function SlaAlertPanel() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<SlaTicket[]>([])
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tickets_with_details')
        .select('id, protocol, company_legal_name, sla_deadline, status, department, open_seconds')
        .not('status', 'in', '("finalizado","cancelado","rascunho")')
        .not('sla_deadline', 'is', null)
        .order('sla_deadline', { ascending: true })
        .limit(10)
      const now = new Date()
      const critical = (data ?? []).filter((t: any) => {
        const deadline = new Date(t.sla_deadline)
        const diff = deadline.getTime() - now.getTime()
        return diff < 2 * 3600000
      })
      setTickets(critical as SlaTicket[])
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  if (tickets.length === 0) return null

  const overdue  = tickets.filter(t => new Date(t.sla_deadline) < new Date())
  const urgent   = tickets.filter(t => new Date(t.sla_deadline) >= new Date())

  return (
    <div className="rounded-xl border overflow-hidden border-red-200 bg-red-50">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-100/50 transition-colors">
        <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
        <span className="text-sm font-medium text-red-700 flex-1">
          {overdue.length > 0
            ? overdue.length + ' atendimento(s) com SLA vencido'
            : urgent.length + ' atendimento(s) vencendo em breve'}
          {overdue.length > 0 && urgent.length > 0 && ' + ' + urgent.length + ' urgente(s)'}
        </span>
        {expanded ? <ChevronUp size={14} className="text-red-500" /> : <ChevronDown size={14} className="text-red-500" />}
      </button>

      {expanded && (
        <div className="border-t border-red-200">
          {tickets.map(t => {
            const { text, overdue: isOverdue } = timeRemaining(t.sla_deadline)
            return (
              <Link key={t.id} href={'/atendimentos/' + t.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-100/50 border-b border-red-100 last:border-0 transition-colors">
                <Clock size={13} className={isOverdue ? 'text-red-600' : 'text-amber-500'} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-900">{t.protocol}</span>
                  <span className="text-xs text-gray-500 ml-2 truncate">{t.company_legal_name}</span>
                </div>
                <span className="text-xs text-gray-500">{DEPT_LABELS[t.department] ?? t.department}</span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                  isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                  {text}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
