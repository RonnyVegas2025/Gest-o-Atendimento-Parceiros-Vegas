import { cn } from '@/lib/utils'
import type { SelectHTMLAttributes } from 'react'

interface Option {
  value: string
  label: string
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Option[]
  placeholder?: string
  error?: string
}

export function Select({ label, options, placeholder, error, className, ...props }: Props) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select className={cn('select', error && 'border-red-300', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

