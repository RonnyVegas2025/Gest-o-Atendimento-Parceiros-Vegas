import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatDateShort(date: string | null): string {
  if (!date) return '—'
  return format(new Date(date), 'dd/MM HH:mm', { locale: ptBR })
}

export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function slaPercent(createdAt: string, deadline: string | null): number {
  if (!deadline) return 0
  const total = differenceInMinutes(new Date(deadline), new Date(createdAt))
  const elapsed = differenceInMinutes(new Date(), new Date(createdAt))
  return Math.min(100, Math.round((elapsed / total) * 100))
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  )
}

