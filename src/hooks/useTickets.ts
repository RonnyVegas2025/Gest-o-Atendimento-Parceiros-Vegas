'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TicketWithDetails, TicketStatus, TicketDepartment, TicketPriority } from '@/lib/types'

interface Filters {
  status?: TicketStatus
  department?: TicketDepartment
  priority?: TicketPriority
  search?: string
  limit?: number
}

export function useTickets(filters: Filters = {}) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('tickets_with_details')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters.status)     query = query.eq('status', filters.status)
      if (filters.department) query = query.eq('department', filters.department)
      if (filters.priority)   query = query.eq('priority', filters.priority)
      if (filters.search) {
        query = query.or(
          `protocol.ilike.%${filters.search}%,` +
          `company_legal_name.ilike.%${filters.search}%,` +
          `employee_name.ilike.%${filters.search}%,` +
          `requester_name.ilike.%${filters.search}%`
        )
      }
      if (filters.limit) query = query.limit(filters.limit)

      const { data, error: err } = await query
      if (err) throw err
      setTickets((data as TicketWithDetails[]) ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.department, filters.priority, filters.search, filters.limit])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // Realtime: atualiza lista ao mudar qualquer ticket
  useEffect(() => {
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' },
        () => fetchTickets()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchTickets])

  return { tickets, loading, error, refetch: fetchTickets }
}

