import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { cnpj: string } }
) {
  try {
    const cnpj = params.cnpj.replace(/\D/g, '')
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 }
    })
    if (!res.ok) throw new Error('CNPJ não encontrado')
    const data = await res.json()
    
    // Normaliza para o mesmo formato da BrasilAPI
    return NextResponse.json({
      razao_social: data.razao_social,
      nome_fantasia: data.estabelecimento?.nome_fantasia,
      logradouro: data.estabelecimento?.logradouro,
      numero: data.estabelecimento?.numero,
      complemento: data.estabelecimento?.complemento,
      bairro: data.estabelecimento?.bairro,
      cep: data.estabelecimento?.cep,
      municipio: data.estabelecimento?.cidade?.nome,
      uf: data.estabelecimento?.estado?.sigla,
      ddd_telefone_1: data.estabelecimento?.telefone1 
        ? `${data.estabelecimento?.ddd1}${data.estabelecimento?.telefone1}` 
        : null,
      email: data.estabelecimento?.email,
      cnae_fiscal_descricao: data.estabelecimento?.atividade_principal?.descricao,
      descricao_situacao_cadastral: data.estabelecimento?.situacao_cadastral,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 })
  }
}
