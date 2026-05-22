import Link from 'next/link'
import { cn } from '@/lib/utils'
import { COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS } from '@/lib/constants'
import type { Company } from '@/lib/types'

interface Props {
  company: Company & { partner?: { name: string } | null }
}

export function CompanyRow({ company }: Props) {
  return (
    <Link
      href={`/empresas/${company.id}`}
      className="table-row grid hover:bg-blue-50/30"
      style={{ gridTemplateColumns: '1fr 140px 160px 90px' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-semibold flex-shrink-0">
          {(company.trade_name || company.legal_name).slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {company.trade_name || company.legal_name}
          </div>
          <div className="text-xs text-gray-400 font-mono">{company.cnpj}</div>
        </div>
      </div>
      <span className="text-sm text-gray-600">{company.city}, {company.state}</span>
      <span className="text-sm text-gray-600 truncate">{company.partner?.name ?? '—'}</span>
      <span className={cn('badge', COMPANY_STATUS_COLORS[company.status])}>
        {COMPANY_STATUS_LABELS[company.status]}
      </span>
    </Link>
  )
}

