import Image from 'next/image'

/*
 * VegasLogo — componente único de logo (VEGAS PLATFORM UI STANDARD v1.0, seções 4/21/24).
 * Nenhum outro arquivo deve referenciar o caminho da imagem diretamente.
 *
 * Observação: por ora existe apenas o PNG oficial (public/brand/vegas-logo.png).
 * As variantes "completa" e "compacta" diferem no tamanho padrão; quando o vetor
 * oficial (SVG) e a marca compacta forem disponibilizados, trocar apenas aqui.
 */
const LOGO_SRC = '/brand/vegas-logo.png'
const LOGO_RATIO = 3123 / 2454 // largura / altura do PNG oficial

export interface VegasLogoProps {
  /** Variante da marca. Hoje ambas usam o PNG oficial; diferem no tamanho padrão. */
  variant?: 'completa' | 'compacta'
  /** Altura em px. Se omitido, usa o padrão da variante. */
  size?: number
  /** Classe extra (ex.: filtro monocromático sobre fundo escuro). */
  className?: string
  /** Prioriza o carregamento (ex.: acima da dobra no login). */
  priority?: boolean
  alt?: string
}

export function VegasLogo({
  variant = 'completa',
  size,
  className,
  priority = false,
  alt = 'Vegas',
}: VegasLogoProps) {
  const height = size ?? (variant === 'compacta' ? 28 : 40)
  const width = Math.round(height * LOGO_RATIO)

  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ height, width: 'auto' }}
    />
  )
}

export default VegasLogo
