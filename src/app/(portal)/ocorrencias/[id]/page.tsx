'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDepartments } from '@/hooks/useDepartments'

/*
 * DETALHE DA OCORRÊNCIA — todos os campos, imagens e edição de status.
 * Sem exclusão: o status pode ir para "cancelada", mas o registro nunca é apagado.
 * Schema assumido conforme a tela de registro (ocorrencias.*).
 */

const GRAVIDADE_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
  media: { label: 'Média', badge: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
  alta:  { label: 'Alta',  badge: 'bg-red-50 text-red-700 border border-red-200',       dot: 'bg-red-500' },
}

const STATUS_OCORRENCIA: Record<string, { label: string; badge: string }> = {
  aberta:     { label: 'Aberta',      badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  em_analise: { label: 'Em análise',  badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  resolvida:  { label: 'Resolvida',   badge: 'bg-green-100 text-green-800 border border-green-300' },
  cancelada:  { label: 'Cancelada',   badge: 'bg-red-50 text-red-700 border border-red-200' },
  reincidente:{ label: 'Reincidente', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('pt-BR')
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-900">{children}</div>
    </div>
  )
}

export default function OcorrenciaDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const { deptLabels } = useDepartments()

  const [o, setO] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tipoNome, setTipoNome] = useState<string>('—')
  const [empresaNome, setEmpresaNome] = useState<string>('—')
  const [ticketProtocol, setTicketProtocol] = useState<string | null>(null)
  const [responsavelNome, setResponsavelNome] = useState<string>('—')
  const [registradoPor, setRegistradoPor] = useState<string>('—')

  const [novoStatus, setNovoStatus] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [okMsg, setOkMsg] = useState(false)

  useEffect(() => { fetchData() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('ocorrencias').select('*').eq('id', id).single()
    const oc = data as any
    setO(oc)
    setNovoStatus(oc?.status ?? '')
    setLoading(false)
    if (!oc) return

    if (oc.tipo_erro_id) {
      supabase.from('tipos_erro').select('nome').eq('id', oc.tipo_erro_id).maybeSingle()
        .then(({ data }) => setTipoNome((data as any)?.nome ?? '—'))
    }
    if (oc.responsavel_id) {
      supabase.from('users_profile').select('full_name').eq('id', oc.responsavel_id).maybeSingle()
        .then(({ data }) => setResponsavelNome((data as any)?.full_name ?? '—'))
    }
    if (oc.created_by) {
      supabase.from('users_profile').select('full_name').eq('id', oc.created_by).maybeSingle()
        .then(({ data }) => setRegistradoPor((data as any)?.full_name ?? '—'))
    }
    if (oc.ticket_id) {
      supabase.from('tickets').select('protocol').eq('id', oc.ticket_id).maybeSingle()
        .then(({ data }) => setTicketProtocol((data as any)?.protocol ?? null))
    }
    if (oc.empresa_nome) {
      // Empresa digitada livremente (sem cadastro)
      setEmpresaNome(oc.empresa_nome)
    } else if (oc.empresa_id) {
      // empresa_id pode referenciar empresas_conveniadas ou companies — resolve best-effort
      supabase.from('empresas_conveniadas').select('nome_fantasia').eq('id', oc.empresa_id).maybeSingle()
        .then(({ data }) => {
          if ((data as any)?.nome_fantasia) { setEmpresaNome((data as any).nome_fantasia); return }
          supabase.from('companies').select('legal_name').eq('id', oc.empresa_id).maybeSingle()
            .then(({ data: c }) => setEmpresaNome((c as any)?.legal_name ?? '—'))
        })
    }
  }

  async function salvarStatus() {
    if (!novoStatus || novoStatus === o.status) return
    setSalvando(true)
    await supabase.from('ocorrencias').update({ status: novoStatus, updated_at: new Date().toISOString() }).eq('id', id)
    setSalvando(false)
    setOkMsg(true)
    setTimeout(() => setOkMsg(false), 1500)
    fetchData()
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!o) return <div className="p-6 text-sm text-red-500">Ocorrência não encontrada.</div>

  const grav = GRAVIDADE_CONFIG[o.gravidade] ?? GRAVIDADE_CONFIG.media
  const st = STATUS_OCORRENCIA[o.status] ?? { label: o.status, badge: 'bg-gray-100 text-gray-600 border border-gray-200' }
  const imagens: string[] = Array.isArray(o.imagens) ? o.imagens : []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/ocorrencias" className="btn btn-sm"><ArrowLeft size={14} /></Link>
        <span className="font-mono text-sm text-gray-400">{o.protocolo || '—'}</span>
        <span className={cn('badge', st.badge)}>{st.label}</span>
        <span className={cn('badge', grav.badge)}><span className={cn('w-1.5 h-1.5 rounded-full', grav.dot)} />{grav.label}</span>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4">
          {/* Informações */}
          <div className="card">
            <div className="card-header"><span className="card-title">Informações</span></div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                <Field label="Departamento">{deptLabels[o.department] ?? o.department}</Field>
                <Field label="Tipo de erro">{tipoNome}</Field>
                <Field label="Data da ocorrência">{fmtDate(o.data_ocorrencia)}</Field>
                <Field label="Gravidade">{grav.label}</Field>
                <Field label="Empresa">{empresaNome}</Field>
                <Field label="Atendimento relacionado">
                  {o.ticket_id
                    ? <Link href={`/atendimentos/${o.ticket_id}`} className="text-[#185FA5] hover:underline font-mono">{ticketProtocol ?? 'ver'}</Link>
                    : '—'}
                </Field>
                <Field label="Pessoa responsável">{o.responsavel_id ? responsavelNome : '—'}</Field>
                <Field label="Registrado por">{registradoPor}</Field>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Título específico</div>
                <div className="text-sm font-medium text-gray-900">{o.titulo}</div>
              </div>

              {o.observacao && (
                <div className="mt-4">
                  <div className="text-xs text-gray-400 mb-2">Observação</div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{o.observacao}</div>
                </div>
              )}

              {imagens.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-gray-400 mb-2">Imagens ({imagens.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {imagens.map((url, i) => (
                      <img key={i} src={url} alt={`Evidência ${i + 1}`}
                        className="h-28 w-auto max-w-xs rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(url, '_blank')} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: edição de status */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Status</span></div>
            <div className="card-body space-y-3">
              <div className="form-group">
                <label className="form-label">Alterar status</label>
                <select className="select" value={novoStatus} onChange={e => setNovoStatus(e.target.value)}>
                  {Object.entries(STATUS_OCORRENCIA).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400">
                O registro nunca é excluído. Para encerrar sem tratativa, defina o status como <strong>Cancelada</strong>.
              </p>
              <button onClick={salvarStatus} disabled={salvando || novoStatus === o.status}
                className="btn-primary w-full justify-center disabled:opacity-50">
                {salvando ? 'Salvando...' : okMsg ? <><Check size={14} /> Salvo!</> : 'Salvar status'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title"><Clock size={14} /> Registro</span></div>
            <div className="card-body space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Aberta em</span>
                <span className="font-medium text-gray-700">{o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Protocolo</span>
                <span className="font-mono text-gray-700">{o.protocolo || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
