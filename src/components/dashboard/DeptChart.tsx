'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEPARTMENT_LABELS } from '@/lib/constants'
import type { TicketDepartment } from '@/lib/types'

interface DeptCount {
  department: TicketDepartment
  count: number
}

export function DeptChart() {
  const [data, setData] = useState<DeptCount[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('tickets')
      .select('department')
      .not('status', 'in', '("finalizado","cancelado")')
      .then(({ data: rows }) => {
        if (!rows) return
        const counts: Record<string, number> = {}
        rows.forEach(r => {
          counts[r.department] = (counts[r.department] ?? 0) + 1
        })
        const sorted = Object.entries(counts)
          .map(([department, count]) => ({ department: department as TicketDepartment, count }))
          .sort((a, b) => b.count - a.count)
        setData(sorted)
      })
  }, [])

  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Sem dados</p>
      ) : (
        data.map(item => (
          <div key={item.department} className="flex items-center gap-3">
            <span className="w-24 text-xs text-gray-500 text-right flex-shrink-0">
              {DEPARTMENT_LABELS[item.department]}
            </span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#185FA5] rounded-full transition-all duration-500"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
            <span className="w-5 text-xs text-gray-400 text-right">{item.count}</span>
          </div>
        ))
      )}
    </div>
  )
}

