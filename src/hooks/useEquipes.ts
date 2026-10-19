'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Equipe {
  id: string
  value: string
  label: string
}

/**
 * Busca dinâmica das equipes ATIVAS na tabela `equipes` (colunas: id, value,
 * label, active), ordenadas por label. As FKs (users_profile.equipe_id,
 * ticket_types.equipe_id, tickets.equipe_id) referenciam `equipes.id`, então o
 * hook chaveia por `id`.
 *
 * Retorna:
 * - `equipes`: lista {id, value, label} (para selects)
 * - `equipeLabels`: mapa id -> label (para traduzir o id em rótulo)
 * - `loading`: true enquanto a query está em andamento
 * - `refetch`: força nova busca (ex.: após criar uma equipe)
 */
export function useEquipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('equipes')
      .select('id, value, label, active')
      .eq('active', true)
      .order('label')
    setEquipes(error || !data ? [] : data.map((e: any) => ({ id: e.id, value: e.value, label: e.label })))
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const equipeLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const e of equipes) map[e.id] = e.label
    return map
  }, [equipes])

  return { equipes, equipeLabels, loading, refetch }
}
