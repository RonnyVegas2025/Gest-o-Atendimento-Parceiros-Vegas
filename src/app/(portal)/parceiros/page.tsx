import { Handshake } from 'lucide-react'

export default function ParceirosPage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-2">Parceiros</h1>
      <div className="card mt-8">
        <div className="py-16 text-center">
          <Handshake size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Módulo em desenvolvimento</p>
          <p className="text-xs text-gray-400 mt-1">Previsto na Fase 2 do roadmap</p>
        </div>
      </div>
    </div>
  )
}

