'use client'
import { useRef, useState } from 'react'
import { X, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  required?: boolean
}

export default function PasteTextarea({
  value, onChange, placeholder, rows = 4, className, required
}: Props) {
  const [images, setImages] = useState<string[]>([])

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return // texto normal — deixa passar

    e.preventDefault()
    imageItems.forEach(item => {
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        setImages(prev => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  return (
    <div className="space-y-0">
      <div className="relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={rows}
          required={required}
          className={cn(
            'textarea w-full',
            images.length > 0 && 'rounded-b-none border-b-0',
            className
          )}
        />
        <span className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none select-none">
          Ctrl+V para colar imagens
        </span>
      </div>

      {images.length > 0 && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl p-3 bg-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <ImageIcon size={11} />
            <span>{images.length} imagem(ns) colada(s)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative group">
                <img
                  src={src}
                  alt={`Print ${i + 1}`}
                  className="h-24 w-auto max-w-[200px] object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(src, '_blank')}
                />
                <button
                  type="button"
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center shadow"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">💡 Clique na imagem para ampliar · Hover para remover</p>
        </div>
      )}
    </div>
  )
}

