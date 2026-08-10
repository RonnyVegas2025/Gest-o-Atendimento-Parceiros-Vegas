'use client'
import LegendHelp from './LegendHelp'
import { IMPACTO_OCORRENCIA } from '@/lib/constants'

/* Legenda dos impactos de ocorrência — reutiliza o LegendHelp genérico. */
export default function ImpactoHelp({ className }: { className?: string }) {
  return (
    <LegendHelp
      className={className}
      title="Impacto da ocorrência"
      ariaLabel="Legenda dos impactos"
      items={Object.entries(IMPACTO_OCORRENCIA).map(([key, s]) => ({ key, label: s.label, badge: s.badge, descricao: s.descricao }))}
    />
  )
}
