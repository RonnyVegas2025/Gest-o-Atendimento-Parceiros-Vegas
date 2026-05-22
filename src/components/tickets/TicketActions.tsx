'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ALLOWED_TRANSITIONS, STATUS_LABELS } from '@/lib/constants'
import type { TicketWithDetails, TicketStatus } from '@/lib/types'
import { Zap, CheckCircle, XCircle } from 'lucide-react'

export default function TicketActions({ ticket }: { ticket: TicketWithDetails }) {
  const router = useRouter()
  const supabase = createClient()
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('')
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)

  const nextStatuses = ALLOWED_TRANSITIONS[ticket.status] ?? []

  async function handleStatusChange() {
    if (!newStatus) return
    setLoading(true)

    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticket.id)

    if (!error && obs.trim()) {
      await supabase.from('ticket_history').insert({
        ticket_id: ticket.id,
        action: obs,
        observation: obs,
      })
    }

    setLoading(false)
    setNewStatus('')
    setObs('')
    router.refresh()
  }

  const isClosed = ['finalizado', 'cancelado'].includes(ticket.status)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Zap size={14} /> Ações</span>
      </div>
      <div className="card-body space-y-3">
        {isClosed ? (
          <p className="text-xs text-gray-400 text-center py-2">
            Atendimento encerrado
          </p>
        ) : (
          <>
            <div>
              <label className="form-label mb-1.5 block">Alterar status</label>
              <select
                className="select"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as TicketStatus)}
              >
                <option value="">Selecione…</option>
                {nextStatuses.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label mb-1.5 block">Observação</label>
              <textarea
                className="textarea text-xs"
                rows={3}
                placeholder="Descreva a ação realizada…"
                value={obs}
                onChange={e => setObs(e.target.value)}
              />
            </div>

            <button
              onClick={handleStatusChange}
              disabled={!newStatus || loading}
              className="btn-primary w-full justify-center"
            >
              <CheckCircle size={14} />
              {loading ? 'Salvando…' : 'Confirmar'}
            </button>

            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={async () => {
                  if (!confirm('Cancelar este atendimento?')) return
                  await supabase.from('tickets').update({ status: 'cancelado' }).eq('id', ticket.id)
                  router.refresh()
                }}
                className="btn-danger w-full justify-center"
              >
                <XCircle size={14} />
                Cancelar atendimento
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

