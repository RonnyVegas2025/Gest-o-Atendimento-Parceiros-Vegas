import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { cnpj: string } }
) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${params.cnpj}`)
    if (!res.ok) throw new Error('CNPJ não encontrado')
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 })
  }
}
