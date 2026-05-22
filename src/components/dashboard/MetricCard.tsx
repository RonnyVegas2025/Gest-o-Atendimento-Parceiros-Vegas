import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: number | string
  suffix?: string
  delta?: string
  deltaPositive?: boolean
  highlight?: boolean
}

export function MetricCard({ label, value, suffix = '', delta, deltaPositive = true, highlight }: Props) {
  return (
    <div className={cn('metric-card', highlight && 'ring-1 ring-red-200 bg-red-50')}>
      <div className={cn('metric-label', highlight && 'text-red-500')}>{label}</div>
      <div className={cn('metric-value', highlight && 'text-red-600')}>
        {value}{suffix}
      </div>
      {delta && (
        <div className={cn('text-xs mt-1', deltaPositive ? 'text-green-600' : 'text-red-500')}>
          {deltaPositive ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  )
}

