'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, timeAgo } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/constants'
import type { TicketHistory } from '@/lib/types'
import { Timeline, Send } from 'lucide-react'

interface Props {
  ticketId: string
  history: TicketHistory[]
}

const DOT_COLORS: Record<string, string> = {
  aberto:             'bg-[#185FA5]',
  em_analise:         'bg-amber-400',
  encaminhado:        'bg-purple-500',
  em_andamento:       'bg-green-500',
  aguardando_retorno: 'bg-gray-400',
  finalizado:         'bg-green-600',
  cancelado:          'bg-red-500',
  default:            'bg-gray-300',
}

export default function TicketHistoryPanel({ ticketId, history: initialHistory }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)

  async function addObservation() {
    if (!obs.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('ticket_history').insert({
      ticket_id: ticketId,
      action:    obs.trim(),
      user_id:   user!.id,
    })

    setObs('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="text-sm">📋</span>
          Histórico
        </span>
        <span className="text-xs text-gray-400">{initialHistory.length} eventos</span>
      </div>

      <div className="card-body">
        {/* Timeline */}
        {initialHistory.length > 0 ? (
          <ol className="relative pl-6 border-l border-gray-100 space-y-5 mb-6">
            {initialHistory.map((item, idx) => {
              const dotColor = item.to_status
                ? (DOT_COLORS[item.to_status] ?? DOT_COLORS.default)
                : (idx === 0 ? DOT_COLORS.aberto : DOT_COLORS.default)

              const userName = (item.user as any)?.full_name ?? 'Sistema'

              return (
                <li key={item.id} className="relative">
                  <span
                    className={`absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${dotColor}`}
                  />
                  <div className="text-sm font-medium text-gray-900">{item.action}</div>
                  {item.observation && item.observation !== item.action && (
                    <div className="text-xs text-gray-500 mt-0.5">{item.observation}</div>
                  )}
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>{userName}</span>
                    <span title={formatDate(item.created_at)}>{timeAgo(item.created_at)}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="text-xs text-gray-400 text-center py-6 mb-4">
            Nenhum evento registrado ainda
          </div>
        )}

        {/* Form de observação */}
        <div className="border-t border-gray-100 pt-4">
          <div className="form-label mb-2">Adicionar observação</div>
          <textarea
            className="textarea text-sm"
            rows={3}
            placeholder="Descreva a ação ou atualização…"
            value={obs}
            onChange={e => setObs(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={addObservation}
              disabled={!obs.trim() || loading}
              className="btn-primary btn-sm"
            >
              <Send size={13} />
              {loading ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

