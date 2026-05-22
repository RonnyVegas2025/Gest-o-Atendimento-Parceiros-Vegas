import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'default', size = 'md', className, children, ...props }: Props) {
  return (
    <button
      className={cn(
        size === 'sm' ? 'btn btn-sm' : 'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'danger'  && 'btn-danger',
        variant === 'ghost'   && 'border-transparent hover:bg-gray-50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

