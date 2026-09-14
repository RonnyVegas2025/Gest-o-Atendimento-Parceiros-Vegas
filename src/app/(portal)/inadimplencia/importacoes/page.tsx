'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, FileSpreadsheet, ChevronRight } from 'lucide-react'
import { fmtMes } from '@/lib/inadimplencia'
import { formatDate } from '@/lib/utils'

/*
 * HISTÓRICO DE IMPORTAÇÕES (uso interno). Data, quem importou, totais e acesso
 * às pendências de cada importação.
 */

const COLS = '110px 1fr 150px 90px 100px 100px 40px'

export default function ImportacoesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('users_profile').select('id, full_name').then(({ data }) => {
      setUsersMap(Object.fromEntries(((data as any[]) ?? []).map(u => [u.id, u.full_name])))
    })
    supabase.from('inadimplencia_importacoes').select('*').order('importado_em', { ascending: false }).limit(500)
      .then(({ data }) => { setRows((data as any[]) ?? []); setLoading(false) })
  }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/inadimplencia" className="btn btn-sm"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Importações de inadimplência</h1>
            <p className="text-xs text-gray-400 mt-0.5">{rows.length} importação(ões) registrada(s)</p>
          </div>
        </div>
        <Link href="/inadimplencia/importar" className="btn-primary"><Upload size={15} /> Importar planilha</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="table-header grid text-xs" style={{ gridTemplateColumns: COLS }}>
          <span>Mês ref.</span><span>Arquivo</span><span>Importado por</span>
          <span>Linhas</span><span>Vinculadas</span><span>Pendentes</span><span></span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhuma importação registrada ainda.</div>
        ) : rows.map(r => (
          <Link key={r.id} href={`/inadimplencia/importacoes/${r.id}`} className="table-row grid hover:bg-blue-50/30" style={{ gridTemplateColumns: COLS }}>
            <span className="text-xs text-gray-600 self-center">{fmtMes(r.mes_referencia)}</span>
            <div className="self-center min-w-0">
              <div className="text-sm text-gray-800 truncate flex items-center gap-1.5"><FileSpreadsheet size={13} className="text-gray-400 flex-shrink-0" />{r.arquivo_nome || '—'}</div>
              <div className="text-xs text-gray-400">{formatDate(r.importado_em)}</div>
            </div>
            <span className="text-xs text-gray-500 self-center truncate">{usersMap[r.importado_por] ?? '—'}</span>
            <span className="text-sm text-gray-700 self-center">{r.total_linhas ?? 0}</span>
            <span className="text-sm text-green-700 self-center">{r.total_vinculadas ?? 0}</span>
            <span className="self-center">
              {r.total_pendentes ? <span className="badge bg-amber-50 text-amber-700 border border-amber-200">{r.total_pendentes}</span> : <span className="text-xs text-gray-300">0</span>}
            </span>
            <ChevronRight size={16} className="text-gray-300 self-center" />
          </Link>
        ))}
      </div>
    </div>
  )
}
