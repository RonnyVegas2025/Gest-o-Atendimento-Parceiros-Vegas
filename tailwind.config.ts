import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vegas: {
          blue:    '#185FA5',
          'blue-dark': '#0C447C',
          'blue-light': '#E6F1FB',
        },
        // VEGAS PLATFORM UI STANDARD v1.0 — lê das CSS vars (hex só em src/styles/tokens.css)
        vg: {
          'brand-400': 'var(--vg-brand-400)',
          'brand-500': 'var(--vg-brand-500)',
          'brand-800': 'var(--vg-brand-800)',
          'rose-400':  'var(--vg-rose-400)',
          'peach-400': 'var(--vg-peach-400)',
          'peach-600': 'var(--vg-peach-600)',
          bg:          'var(--vg-bg)',
          surface:     'var(--vg-surface)',
          ink:         'var(--vg-ink)',
          'ink-secondary': 'var(--vg-ink-secondary)',
          'border-field':  'var(--vg-border-field)',
          'success-bg': 'var(--vg-success-bg)', 'success-fg': 'var(--vg-success-fg)',
          'warning-bg': 'var(--vg-warning-bg)', 'warning-fg': 'var(--vg-warning-fg)',
          'danger-bg':  'var(--vg-danger-bg)',  'danger-fg':  'var(--vg-danger-fg)',
          'info-bg':    'var(--vg-info-bg)',     'info-fg':    'var(--vg-info-fg)',
          'neutral-bg': 'var(--vg-neutral-bg)',  'neutral-fg': 'var(--vg-neutral-fg)',
        },
      },
      backgroundImage: {
        // Gradiente institucional (assinatura discreta — faixa 2–3px)
        'vg-institucional': 'var(--vg-gradient-institucional)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        // Display (Outfit) — títulos, cards e KPIs
        display: ['var(--font-outfit)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Escala tipográfica oficial (seção 4.1)
        'display-xl': ['32px', { lineHeight: '40px' }],
        'h1':      ['24px', { lineHeight: '32px' }],
        'h2':      ['20px', { lineHeight: '28px' }],
        'h3':      ['16px', { lineHeight: '24px' }],
        'body':    ['14px', { lineHeight: '22px' }],
        'body-sm': ['13px', { lineHeight: '20px' }],
        'caption': ['12px', { lineHeight: '18px' }],
      },
    },
  },
  plugins: [],
}
export default config
