'use client'
import LegendHelp from './LegendHelp'
import { STATUS_OCORRENCIA } from '@/lib/constants'

/* Legenda dos status de ocorrência — reutiliza o LegendHelp genérico. */
export default function StatusHelp({ className }: { className?: string }) {
  return (
    <LegendHelp
      className={className}
      title="Status da ocorrência"
      ariaLabel="Legenda dos status"
      items={Object.entries(STATUS_OCORRENCIA).map(([key, s]) => ({ key, label: s.label, badge: s.badge, descricao: s.descricao }))}
    />
  )
}
