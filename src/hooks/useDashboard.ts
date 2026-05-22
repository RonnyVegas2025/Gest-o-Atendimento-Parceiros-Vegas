'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DashboardSummary } from '@/lib/types'

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchSummary = useCallback(async () => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('dashboard_summary')
        .select('*')
      if (err) throw err
      setSummary((data?.[0] as DashboardSummary) ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // Atualiza métricas a cada mudança em tickets
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' },
        () => fetchSummary()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchSummary])

  return { summary, loading, error, refetch: fetchSummary }
}

