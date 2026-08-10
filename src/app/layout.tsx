import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import '../styles/tokens.css'
import './globals.css'

// Interface (Inter) e Display (Outfit) expostos como CSS vars — VEGAS PLATFORM UI STANDARD v1.0 (seção 4)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })

export const metadata: Metadata = {
  title: 'Portal Parceiros Vegas',
  description: 'Gestão de atendimentos especiais Vegas Card',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable}`}>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
