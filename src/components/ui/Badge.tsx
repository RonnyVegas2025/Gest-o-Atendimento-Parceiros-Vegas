import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
}

export function Badge({ children, className }: Props) {
  return (
    <span className={cn('badge', className)}>
      {children}
    </span>
  )
}

