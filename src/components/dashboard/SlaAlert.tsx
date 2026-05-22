import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface Props {
  count: number
}

export function SlaAlert({ count }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>
        <strong>{count}</strong> atendimento{count > 1 ? 's' : ''} com SLA vencido.{' '}
        <Link href="/atendimentos?sla=vencido" className="underline underline-offset-2 font-medium">
          Ver agora
        </Link>
      </span>
    </div>
  )
}

