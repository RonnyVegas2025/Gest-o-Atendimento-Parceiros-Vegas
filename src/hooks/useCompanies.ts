'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Company, CompanyStatus } from '@/lib/types'

interface Filters {
  status?: CompanyStatus
  search?: string
  partnerId?: string
}

export function useCompanies(filters: Filters = {}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('companies')
        .select('*, partner:partner_id(name)')
        .order('legal_name')

      if (filters.status)    query = query.eq('status', filters.status)
      if (filters.partnerId) query = query.eq('partner_id', filters.partnerId)
      if (filters.search) {
        query = query.or(
          `legal_name.ilike.%${filters.search}%,` +
          `trade_name.ilike.%${filters.search}%,` +
          `cnpj.ilike.%${filters.search}%,` +
          `city.ilike.%${filters.search}%`
        )
      }

      const { data, error: err } = await query
      if (err) throw err
      setCompanies((data as Company[]) ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.partnerId, filters.search])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  return { companies, loading, error, refetch: fetchCompanies }
}

