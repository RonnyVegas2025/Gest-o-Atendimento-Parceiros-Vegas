'use client'
import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Legenda genérica — ícone de ajuda (Lucide HelpCircle) que abre um popover
 * listando itens (rótulo + descrição). Reutilizado para Status e Impacto das
 * ocorrências. Acessível por teclado (botão nativo, foco visível, fecha no Esc e
 * ao clicar fora). VEGAS PLATFORM UI STANDARD v1.0.
 */
export interface LegendItem {
  key: string
  label: string
  badge?: string
  descricao: string
}

export default function LegendHelp({
  title,
  items,
  ariaLabel,
  className,
}: {
  title: string
  items: LegendItem[]
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className={cn('relative inline-flex', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel ?? title}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-[#185FA5] focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:ring-offset-1 transition-colors"
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel ?? title}
          className="absolute z-30 top-full left-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3 space-y-2"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{title}</div>
          {items.map(it => (
            <div key={it.key} className="flex flex-col gap-0.5">
              <span className={cn('badge self-start', it.badge ?? 'bg-gray-100 text-gray-600 border border-gray-200')}>{it.label}</span>
              <span className="text-xs text-gray-500 leading-snug">{it.descricao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
