'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Department {
  value: string
  label: string
}

/**
 * Busca dinâmica dos departamentos ativos na tabela `departments` do Supabase
 * (colunas: value, label, active), filtrando active = true e ordenando por label.
 *
 * Lê SEMPRE do banco — sem fallback hardcoded. Se a query falhar ou a tabela
 * estiver vazia, a lista fica vazia (os selects não mostram opções).
 *
 * Retorna:
 * - `departments`: lista {value, label} (para selects e .find)
 * - `deptLabels`: mapa value -> label (para traduzir códigos em rótulos)
 * - `loading`: true enquanto a query está em andamento
 * - `refetch`: força uma nova busca no banco (ex.: ao abrir um filtro)
 */
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('departments')
      .select('value, label, active')
      .eq('active', true)
      .order('label')
    setDepartments(error || !data ? [] : data.map((d: any) => ({ value: d.value, label: d.label })))
    setLoading(false)
  }, [])

  // Busca inicial na montagem
  useEffect(() => { refetch() }, [refetch])

  const deptLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of departments) map[d.value] = d.label
    return map
  }, [departments])

  return { departments, deptLabels, loading, refetch }
}
