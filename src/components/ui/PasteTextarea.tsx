'use client'
import { useRef, useState } from 'react'
import { X, ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value: string
  onChange: (value: string) => void
  onImagesChange?: (urls: string[]) => void
  placeholder?: string
  rows?: number
  className?: string
  required?: boolean
}

export default function PasteTextarea({
  value, onChange, onImagesChange, placeholder, rows = 4, className, required
}: Props) {
  const [images, setImages] = useState<{ url: string; uploading: boolean }[]>([])
  const supabase = createClient()

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.type.split('/')[1] ?? 'png'
    const path = `tickets/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('atendimentos').upload(path, file)
    if (error) { console.error('Upload error:', error); return null }
    const { data } = supabase.storage.from('atendimentos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return
    e.preventDefault()

    for (const item of imageItems) {
      const file = item.getAsFile()
      if (!file) continue

      // Mostra preview imediato com loading
      const localUrl = URL.createObjectURL(file)
      setImages(prev => {
        const next = [...prev, { url: localUrl, uploading: true }]
        return next
      })

      // Faz upload
      const publicUrl = await uploadImage(file)
      if (publicUrl) {
        setImages(prev => {
          const next = prev.map(img => img.url === localUrl ? { url: publicUrl, uploading: false } : img)
          onImagesChange?.(next.filter(i => !i.uploading).map(i => i.url))
          return next
        })
      } else {
        setImages(prev => prev.filter(img => img.url !== localUrl))
      }
    }
  }

  function removeImage(url: string) {
    setImages(prev => {
      const next = prev.filter(img => img.url !== url)
      onImagesChange?.(next.filter(i => !i.uploading).map(i => i.url))
      return next
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
          className={cn('textarea w-full', images.length > 0 && 'rounded-b-none border-b-0', className)}
        />
        <span className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none select-none">
          Ctrl+V para colar imagens
        </span>
      </div>
      {images.length > 0 && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl p-3 bg-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <ImageIcon size={11} />
            <span>{images.length} imagem(ns)</span>
            {images.some(i => i.uploading) && <span className="text-blue-500">· enviando...</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                {img.uploading ? (
                  <div className="h-24 w-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={`Print ${i + 1}`}
                    className="h-24 w-auto max-w-[200px] object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(img.url, '_blank')}
                  />
                )}
                {!img.uploading && (
                  <button
                    type="button"
                    onClick={() => removeImage(img.url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center shadow"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">💡 Clique para ampliar · Hover para remover</p>
        </div>
      )}
    </div>
  )
}
