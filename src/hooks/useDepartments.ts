'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Department {
  value: string
  label: string
}

/**
 * Fallback com os 11 departamentos atuais. Usado enquanto a query carrega e
 * caso ela falhe ou retorne vazio — assim os selects nunca ficam sem opções.
 */
export const DEPARTMENTS_FALLBACK: Department[] = [
  { value: 'comercial',   label: 'ADM Comercial' },
  { value: 'cadastro',    label: 'Cadastro' },
  { value: 'financeiro',  label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'rede',        label: 'Rede' },
  { value: 'marketing',   label: 'Marketing' },
  { value: 'juridico',    label: 'Juridico' },
  { value: 'logistica',   label: 'Logistica' },
  { value: 'ti_vegas',    label: 'T.I Vegas' },
  { value: 'ti_ifc',      label: 'T.I IFC' },
  { value: 'ti_swap',     label: 'T.I Swap' },
]

/**
 * Busca dinâmica dos departamentos ativos na tabela `departments` do Supabase
 * (colunas: value, label, active), filtrando active = true e ordenando por label.
 *
 * Retorna:
 * - `departments`: lista {value, label} (para selects e .find)
 * - `deptLabels`: mapa value -> label (para traduzir códigos em rótulos)
 * - `loading`: true enquanto a query está em andamento
 */
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENTS_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase
      .from('departments')
      .select('value, label, active')
      .eq('active', true)
      .order('label')
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data || data.length === 0) {
          // Mantém o fallback caso a query falhe ou volte vazia
          setDepartments(DEPARTMENTS_FALLBACK)
        } else {
          setDepartments(data.map((d: any) => ({ value: d.value, label: d.label })))
        }
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const deptLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of departments) map[d.value] = d.label
    return map
  }, [departments])

  return { departments, deptLabels, loading }
}
