import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { cnpj: string } }
) {
  const cnpj = params.cnpj.replace(/\D/g, '')

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
  }

  // Tenta BrasilAPI primeiro
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }
  } catch {}

  // Fallback: ReceitaWS
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    })

    if (res.ok) {
      const d = await res.json()
      if (d.status !== 'ERROR') {
        // Normaliza para o mesmo formato da BrasilAPI
        return NextResponse.json({
          razao_social:                 d.nome,
          nome_fantasia:                d.fantasia,
          descricao_situacao_cadastral: d.situacao,
          cnae_fiscal:                  d.atividade_principal?.[0]?.code?.replace(/\D/g, ''),
          cnae_fiscal_descricao:        d.atividade_principal?.[0]?.text,
          logradouro:                   d.logradouro,
          numero:                       d.numero,
          complemento:                  d.complemento,
          bairro:                       d.bairro,
          cep:                          d.cep?.replace(/\D/g, ''),
          municipio:                    d.municipio,
          uf:                           d.uf,
          ddd_telefone_1:               d.telefone,
          email:                        d.email,
        })
      }
    }
  } catch {}

  return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 })
}

