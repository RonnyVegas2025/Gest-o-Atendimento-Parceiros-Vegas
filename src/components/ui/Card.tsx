import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return <div className={cn('card', className)}>{children}</div>
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('card-header', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <span className={cn('card-title', className)}>{children}</span>
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('card-body', className)}>{children}</div>
}

