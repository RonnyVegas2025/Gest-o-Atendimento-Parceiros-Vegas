'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TicketWithDetails, TicketHistory, TicketStatus } from '@/lib/types'

export function useTicket(id: string) {
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [history, setHistory] = useState<TicketHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchTicket = useCallback(async () => {
    setError(null)
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from('tickets_with_details').select('*').eq('id', id).single(),
      supabase
        .from('ticket_history')
        .select('*, user:user_id(full_name, role)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
    ])
    if (t) setTicket(t as TicketWithDetails)
    else setError('Atendimento não encontrado')
    setHistory((h as TicketHistory[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchTicket() }, [fetchTicket])

  // Realtime neste ticket específico
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tickets',
        filter: `id=eq.${id}`,
      }, () => fetchTicket())
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ticket_history',
        filter: `ticket_id=eq.${id}`,
      }, () => fetchTicket())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, fetchTicket])

  async function updateStatus(newStatus: TicketStatus, observation?: string) {
    const { error: err } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', id)
    if (err) throw err
    if (observation) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('ticket_history').insert({
        ticket_id: id,
        action: observation,
        observation,
        user_id: user!.id,
      })
    }
    await fetchTicket()
  }

  async function addObservation(text: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('ticket_history').insert({
      ticket_id: id,
      action: text,
      user_id: user!.id,
    })
    await fetchTicket()
  }

  return { ticket, history, loading, error, updateStatus, addObservation, refetch: fetchTicket }
}

