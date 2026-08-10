'use client'
import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_OCORRENCIA } from '@/lib/constants'

/*
 * Legenda dos status de ocorrência — ícone de ajuda (Lucide HelpCircle) que abre
 * um popover listando os cinco status e suas descrições. Reutilizado no detalhe e
 * no filtro da lista. Acessível por teclado (botão nativo, foco visível, fecha no
 * Esc e ao clicar fora). VEGAS PLATFORM UI STANDARD v1.0.
 */
export default function StatusHelp({ className }: { className?: string }) {
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
        aria-label="Legenda dos status"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-[#185FA5] focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:ring-offset-1 transition-colors"
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Descrição dos status da ocorrência"
          className="absolute z-30 top-full left-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3 space-y-2"
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Status da ocorrência</div>
          {Object.entries(STATUS_OCORRENCIA).map(([value, s]) => (
            <div key={value} className="flex flex-col gap-0.5">
              <span className={cn('badge self-start', s.badge)}>{s.label}</span>
              <span className="text-xs text-gray-500 leading-snug">{s.descricao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
