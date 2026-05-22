'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Partner } from '@/lib/types'

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchPartners = useCallback(async () => {
    const { data } = await supabase
      .from('partners')
      .select('*')
      .eq('active', true)
      .order('name')
    setPartners((data as Partner[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  return { partners, loading, refetch: fetchPartners }
}

