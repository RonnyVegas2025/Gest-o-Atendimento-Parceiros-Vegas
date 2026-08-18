'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDepartments } from '@/hooks/useDepartments'
import { STATUS_OCORRENCIA, IMPACTO_OCORRENCIA } from '@/lib/constants'
import StatusHelp from '@/components/ocorrencias/StatusHelp'
import ImpactoHelp from '@/components/ocorrencias/ImpactoHelp'

/*
 * LISTA DE OCORRÊNCIAS. Schema assumido (`ocorrencias`): protocolo, department,
 * tipo_erro_id, titulo, gravidade, status, data_ocorrencia, created_by, created_at.
 */

const GRAVIDADE_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
  media: { label: 'Média', badge: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
  alta:  { label: 'Alta',  badge: 'bg-red-50 text-red-700 border border-red-200',       dot: 'bg-red-500' },
}

const PERIODOS = [
  { value: '',    label: 'Todo o período' },
  { value: '7',   label: 'Últimos 7 dias' },
  { value: '30',  label: 'Últimos 30 dias' },
  { value: '90',  label: 'Últimos 90 dias' },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('pt-BR')
}

export default function OcorrenciasPage() {
  const supabase = createClient()
  const { deptLabels, departments, refetch: refetchDepartments } = useDepartments()

  const [ocorrencias, setOcorrencias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tiposMap, setTiposMap] = useState<Record<string, string>>({})
  const [tipos, setTipos] = useState<{ id: string; nome: string; department: string }[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})

  const [fDept, setFDept] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fGrav, setFGrav] = useState('')
  const [fImpacto, setFImpacto] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPeriodo, setFPeriodo] = useState('')

  // Listas de apoio (nomes de tipo e de quem registrou)
  useEffect(() => {
    supabase.from('tipos_erro').select('id, nome, department').then(({ data }) => {
      const arr = (data as any[]) ?? []
      setTipos(arr)
      setTiposMap(Object.fromEntries(arr.map(t => [t.id, t.nome])))
    })
    supabase.from('users_profile').select('id, full_name').then(({ data }) => {
      setUsersMap(Object.fromEntries(((data as any[]) ?? []).map(u => [u.id, u.full_name])))
    })
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('ocorrencias').select('*').order('data_ocorrencia', { ascending: false }).limit(200)
      if (fDept)   query = query.eq('department', fDept)
      if (fTipo)   query = query.eq('tipo_erro_id', fTipo)
      if (fGrav)    query = query.eq('gravidade', fGrav)
      if (fImpacto) query = query.eq('impacto', fImpacto)
      if (fStatus)  query = query.eq('status', fStatus)
      if (fPeriodo) {
        const d = new Date(); d.setDate(d.getDate() - parseInt(fPeriodo))
        query = query.gte('data_ocorrencia', d.toISOString().slice(0, 10))
      }
      const { data } = await query
      setOcorrencias((data as any[]) ?? [])
      setLoading(false)
    }
    load()
  }, [fDept, fTipo, fGrav, fImpacto, fStatus, fPeriodo])

  const tiposDoFiltro = useMemo(
    () => (fDept ? tipos.filter(t => t.department === fDept) : tipos),
    [tipos, fDept]
  )

  const COLS = '150px 90px 130px 1fr 95px 110px 100px 140px'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ocorrências</h1>
          <p className="text-xs text-gray-400 mt-0.5">{ocorrencias.length} registro(s) · erros por departamento para análise de causa raiz</p>
        </div>
        <Link href="/ocorrencias/nova" className="btn-primary"><Plus size={15} /> Nova ocorrência</Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="select w-44" value={fDept}
          onFocus={() => refetchDepartments()}
          onMouseDown={() => refetchDepartments()}
          onChange={e => { setFDept(e.target.value); setFTipo('') }}>
          <option value="">Todos os depto.</option>
          {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select className="select w-44" value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tiposDoFiltro.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select className="select w-36" value={fGrav} onChange={e => setFGrav(e.target.value)}>
          <option value="">Gravidade</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </select>
        <div className="inline-flex items-center gap-1.5">
          <select className="select w-40" value={fImpacto} onChange={e => setFImpacto(e.target.value)}>
            <option value="">Todos os impactos</option>
            {Object.entries(IMPACTO_OCORRENCIA).map(([v, im]) => <option key={v} value={v}>{im.label}</option>)}
          </select>
          <ImpactoHelp />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <select className="select w-40" value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_OCORRENCIA).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <StatusHelp />
        </div>
        <select className="select w-40" value={fPeriodo} onChange={e => setFPeriodo(e.target.value)}>
          {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="table-header grid text-xs" style={{ gridTemplateColumns: COLS }}>
          <span>Protocolo</span><span>Data</span><span>Departamento</span><span>Título</span>
          <span>Gravidade</span><span>Impacto</span><span>Status</span><span>Registrado por</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : ocorrencias.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Nenhuma ocorrência encontrada.</div>
        ) : ocorrencias.map(o => {
          const grav = GRAVIDADE_CONFIG[o.gravidade] ?? GRAVIDADE_CONFIG.media
          const st = STATUS_OCORRENCIA[o.status] ?? { label: o.status, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
          const imp = o.impacto ? IMPACTO_OCORRENCIA[o.impacto] : null
          return (
            <Link key={o.id} href={`/ocorrencias/${o.id}`} className="table-row grid hover:bg-blue-50/30" style={{ gridTemplateColumns: COLS }}>
              <span className="font-mono text-xs text-indigo-600 self-center truncate flex items-center gap-1">
                {o.solucao && <span title="Solução registrada" aria-label="Solução registrada" className="text-green-600 flex-shrink-0"><Wrench size={11} /></span>}
                {o.protocolo || '—'}
              </span>
              <span className="text-xs text-gray-500 self-center">{fmtDate(o.data_ocorrencia)}</span>
              <span className="text-xs text-gray-600 self-center truncate">{deptLabels[o.department] ?? o.department}</span>
              <div className="self-center min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{o.titulo}</div>
                <div className="text-xs text-gray-400 truncate">{tiposMap[o.tipo_erro_id] ?? '—'}</div>
              </div>
              <span className="self-center">
                <span className={cn('badge', grav.badge)}><span className={cn('w-1.5 h-1.5 rounded-full', grav.dot)} />{grav.label}</span>
              </span>
              <span className="self-center">
                {imp ? <span className={cn('badge', imp.badge)}>{imp.label}</span> : <span className="text-xs text-gray-300">—</span>}
              </span>
              <span className="self-center"><span className={cn('badge', st.badge)}>{st.label}</span></span>
              <span className="text-xs text-gray-500 self-center truncate">{usersMap[o.created_by] ?? '—'}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
